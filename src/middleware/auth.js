// Verify the Supabase access token locally (fast, no network call), attach req.user.
// requireAdmin additionally checks the user's profile role in the DB.
const jwt = require("jsonwebtoken");
const { supabaseAdmin } = require("../config/supabase");

// function authenticate(req, res, next) {
//   const header = req.headers.authorization || "";
//   const token = header.startsWith("Bearer ") ? header.slice(7) : null;
//   if (!token) return res.status(401).json({ error: "Authentication required" });
//   try {
//     const payload = jwt.verify(token, process.env.SUPABASE_JWT_SECRET);
//     req.user = { id: payload.sub, email: payload.email };
//     req.accessToken = token;
//     next();
//   } catch {
//     return res.status(401).json({ error: "Invalid or expired token" });
//   }
// }


async function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ")
    ? header.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({
      error: "Authentication required",
    });
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({
      error: "Invalid token",
    });
  }

  req.user = {
    id: user.id,
    email: user.email,
  };

  req.accessToken = token;

  next();
}

// Like authenticate, but doesn't fail if no token (guest-friendly routes).
function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.SUPABASE_JWT_SECRET);
      req.user = { id: payload.sub, email: payload.email };
      req.accessToken = token;
    } catch {
      /* ignore bad token, treat as guest */
    }
  }
  next();
}

async function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Authentication required" });
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", req.user.id)
    .single();
  if (error || !data || data.role !== "admin") {
    return res.status(403).json({ error: "Admin access only" });
  }
  next();
}

module.exports = { authenticate, optionalAuth, requireAdmin };
