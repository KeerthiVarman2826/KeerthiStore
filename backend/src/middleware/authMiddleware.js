const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'A valid login token is required.' });
  }

  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is not set in the environment.');
    return res.status(500).json({ message: 'Authentication is not configured.' });
  }

  const token = authorization.slice('Bearer '.length);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (
      typeof payload === 'string' ||
      typeof payload.userId !== 'string'
    ) {
      return res.status(401).json({ message: 'Invalid login token.' });
    }

    req.userId = payload.userId;
    return next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ message: 'Invalid or expired login token.' });
    }

    console.error('Token verification failed:', error);
    return res.status(500).json({ message: 'Unable to verify login token.' });
  }
};

module.exports = authMiddleware;
