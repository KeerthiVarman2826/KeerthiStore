
function showMessage() {
    alert("Welcome to KeerthiStore!");
}

const registerForm = document.querySelector("#register-form");

if (registerForm) {
    const formMessage = document.querySelector("#form-message");
    const submitButton = registerForm.querySelector('button[type="submit"]');

    registerForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        formMessage.textContent = "";
        formMessage.className = "form-message";

        if (!registerForm.checkValidity()) {
            registerForm.reportValidity();
            return;
        }

        const formData = new FormData(registerForm);
        const user = {
            name: formData.get("name").trim(),
            email: formData.get("email").trim(),
            password: formData.get("password"),
        };

        submitButton.disabled = true;
        submitButton.querySelector("span").textContent = "Creating account...";

        try {
            const response = await fetch("http://localhost:5000/api/users/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(user),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    response.status === 409
                        ? "That email is already registered. Try logging in instead."
                        : result.message || "Registration failed. Please check your details and try again."
                );
            }

            registerForm.reset();
            formMessage.textContent = result.message || "Your account was created successfully.";
            formMessage.classList.add("is-success");
        } catch (error) {
            formMessage.textContent =
                error instanceof TypeError
                    ? "Could not reach the server. Make sure the backend is running on port 5000."
                    : error.message;
            formMessage.classList.add("is-error");
        } finally {
            submitButton.disabled = false;
            submitButton.querySelector("span").textContent = "Create account";
        }
    });
}

const loginForm = document.querySelector("#login-form, #loginForm");

if (loginForm) {
    const loginMessage = document.querySelector("#login-message, #message");
    const loginButton = loginForm.querySelector(
        'button[type="submit"], button:not([type]), input[type="submit"]'
    );
    const emailInput = loginForm.querySelector("#login-email, #email");
    const passwordInput = loginForm.querySelector("#login-password, #password");
    const passwordToggle = loginForm.querySelector(".password-toggle");

    if (passwordToggle && passwordInput) {
        passwordToggle.addEventListener("click", () => {
            const isPasswordHidden = passwordInput.type === "password";
            passwordInput.type = isPasswordHidden ? "text" : "password";
            passwordToggle.setAttribute("aria-pressed", String(isPasswordHidden));
            passwordToggle.setAttribute(
                "aria-label",
                isPasswordHidden ? "Hide password" : "Show password"
            );
        });
    }

    if (!loginMessage || !loginButton || !emailInput || !passwordInput) {
        console.error(
            "Login form is missing a message element, submit button, email input, or password input."
        );
    } else if (loginForm.dataset.loginHandlerAttached !== "true") {
        loginMessage.classList.add("login-message");
        loginForm.dataset.loginHandlerAttached = "true";
        const buttonLabel = loginButton.querySelector("span");
        const originalButtonText = buttonLabel
            ? buttonLabel.textContent
            : loginButton.value || loginButton.textContent;

        loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        loginMessage.textContent = "";
        loginMessage.classList.remove("is-success", "is-error");

        if (!loginForm.checkValidity()) {
            loginForm.reportValidity();
            return;
        }

        const credentials = {
            email: emailInput.value.trim(),
            password: passwordInput.value,
        };

        loginButton.disabled = true;
        if (buttonLabel) {
            buttonLabel.textContent = "Signing in...";
        } else if (loginButton instanceof HTMLInputElement) {
            loginButton.value = "Signing in...";
        } else {
            loginButton.textContent = "Signing in...";
        }

        try {
            const response = await fetch("http://localhost:5000/api/users/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(credentials),
            });

            let result;
            try {
                result = await response.json();
            } catch {
                result = {};
            }

            if (!response.ok) {
                throw new Error(
                    result.message ||
                    (response.status === 401
                        ? "Incorrect email or password. Please try again."
                        : "Login failed. Please try again.")
                );
            }

            if (
                typeof result.token !== "string" ||
                !result.user ||
                typeof result.user !== "object" ||
                Array.isArray(result.user) ||
                typeof result.user.name !== "string" ||
                typeof result.user.email !== "string"
            ) {
                throw new Error("The server returned an invalid login response.");
            }

            const safeUser = {
                id: result.user.id,
                name: result.user.name,
                email: result.user.email,
                role: result.user.role === "admin" ? "admin" : "user",
            };

            try {
                sessionStorage.setItem("token", result.token);
                sessionStorage.setItem("user", JSON.stringify(safeUser));
            } catch (error) {
                sessionStorage.removeItem("token");
                sessionStorage.removeItem("user");
                throw new Error("Could not save your login session in this browser.");
            }

            loginMessage.textContent = "Login successful";
            loginMessage.classList.add("is-success");
            loginForm.reset();
            window.setTimeout(() => {
                window.location.assign("dashboard.html");
            }, 600);
        } catch (error) {
            loginMessage.textContent =
                error instanceof TypeError
                    ? "Could not connect to the server. Check that the backend is running on port 5000."
                    : error.message;
            loginMessage.classList.add("is-error");
        } finally {
            loginButton.disabled = false;
            if (buttonLabel) {
                buttonLabel.textContent = originalButtonText;
            } else if (loginButton instanceof HTMLInputElement) {
                loginButton.value = originalButtonText;
            } else {
                loginButton.textContent = originalButtonText;
            }
        }
        });
    }
}

const dashboardPage = document.querySelector(".dashboard-page");

if (dashboardPage) {
    const dashboardMessage = document.querySelector("#dashboard-message");
    const dashboardLogoutButtons = document.querySelectorAll(".dashboard-logout");
    const dashboardNameElements = [
        document.querySelector("#dashboard-welcome-name"),
        document.querySelector("#dashboard-user-name"),
        document.querySelector("#dashboard-info-name"),
    ];
    const dashboardEmailElements = [
        document.querySelector("#dashboard-user-email"),
        document.querySelector("#dashboard-info-email"),
    ];

    const logout = () => {
        try {
            sessionStorage.removeItem("token");
            sessionStorage.removeItem("user");
        } catch (error) {
            console.error("Could not clear the login session:", error);
        } finally {
            window.location.replace("login.html");
        }
    };

    const showDashboardUser = (user) => {
        dashboardNameElements.forEach((element) => {
            element.textContent = user.name;
        });
        dashboardEmailElements.forEach((element) => {
            element.textContent = user.email;
        });
        document.querySelector("#dashboard-avatar").textContent =
            user.name.trim().charAt(0).toUpperCase();
        document.querySelector(".dashboard-grid").setAttribute("aria-busy", "false");
    };

    const showProfileError = (message) => {
        dashboardMessage.textContent = message;
        dashboardNameElements.forEach((element) => {
            element.textContent = "Unavailable";
        });
        dashboardEmailElements.forEach((element) => {
            element.textContent = "Unavailable";
        });
        document.querySelector("#dashboard-avatar").textContent = "?";
        document.querySelector(".dashboard-grid").setAttribute("aria-busy", "false");
    };

    dashboardLogoutButtons.forEach((button) => {
        button.addEventListener("click", logout);
    });

    let token;
    try {
        token = sessionStorage.getItem("token");
    } catch (error) {
        console.error("Could not read the login session:", error);
        logout();
    }

    try {
        const cachedUser = JSON.parse(sessionStorage.getItem("user") || "null");
        if (cachedUser && cachedUser.role === "admin") {
            document.querySelectorAll("[data-admin-link]").forEach((link) => {
                link.hidden = false;
            });
        }
    } catch {
        /* proceed with profile load */
    }

    if (typeof token !== "string" || !token.trim()) {
        logout();
    } else {
        const loadProfile = async () => {
            try {
                const response = await fetch("http://localhost:5000/api/users/profile", {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });

                if (response.status === 401 || response.status === 403) {
                    logout();
                    return;
                }

                let result;
                try {
                    result = await response.json();
                } catch {
                    throw new Error("The server returned an unreadable profile response.");
                }

                if (!response.ok) {
                    throw new Error(result.message || "Could not load your profile.");
                }

                const profile = result.user;
                if (
                    !profile ||
                    typeof profile.name !== "string" ||
                    !profile.name.trim() ||
                    typeof profile.email !== "string" ||
                    !profile.email.trim()
                ) {
                    throw new Error("The server returned an unexpected profile response.");
                }

                const safeUser = {
                    id: profile.id,
                    name: profile.name,
                    email: profile.email,
                    role: profile.role === "admin" ? "admin" : "user",
                };
                showDashboardUser(safeUser);
                dashboardMessage.textContent = "";
                try {
                    sessionStorage.setItem("user", JSON.stringify(safeUser));
                } catch (error) {
                    console.error("Could not update cached profile information:", error);
                }
                document.querySelectorAll("[data-admin-link]").forEach((link) => {
                    link.hidden = safeUser.role !== "admin";
                });
            } catch (error) {
                showProfileError(
                    error instanceof TypeError
                        ? "Could not connect to KeerthiStore. Make sure the backend is running on port 5000, then refresh this page."
                        : error.message
                );
                console.error("Could not load the authenticated profile:", error);
            }
        };

        loadProfile();
    }
}
