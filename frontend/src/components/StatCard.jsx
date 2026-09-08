export default function StatCard({ label, value, tone }) {
  return (
    <div className={"stat-card" + (tone ? ` ${tone}` : "")}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}
