/** Re-mounts on each navigation so new content cross-fades in after the route skeleton. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="reveal flex min-w-0 flex-1 flex-col">{children}</div>;
}
