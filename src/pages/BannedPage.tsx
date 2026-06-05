import { Link } from "react-router-dom";

const BannedPage = () => (
  <div className="min-h-screen bg-background flex items-center justify-center p-6">
    <div className="max-w-xl w-full glass-card border border-destructive/20 p-8 text-center">
      <h1 className="text-3xl font-bold text-destructive mb-3">Account Suspended</h1>
      <p className="text-muted-foreground mb-6">
        Your account has been temporarily restricted due to policy or moderation actions.
        If you believe this is a mistake, please contact support.
      </p>
      <Link
        to="/"
        className="inline-flex items-center justify-center rounded-full bg-destructive text-destructive-foreground px-5 py-2 text-sm font-semibold hover:bg-destructive/90 transition"
      >
        Return to home
      </Link>
    </div>
  </div>
);

export default BannedPage;
