import { logout } from "@/lib/actions/auth";

export function LogoutButton({ className }: { className?: string }) {
  return (
    <form action={logout}>
      <button
        type="submit"
        className={
          className ??
          "rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-navy hover:bg-background"
        }
      >
        Sign out
      </button>
    </form>
  );
}
