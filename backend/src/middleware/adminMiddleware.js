const User = require('../models/User');

const adminMiddleware = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select('role');
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Administrator access is required.' });
    }

    return next();
  } catch (error) {
    console.error('Administrator authorization failed:', error);
    return res.status(500).json({ message: 'Unable to verify administrator access.' });
  }
};

module.exports = adminMiddleware;
