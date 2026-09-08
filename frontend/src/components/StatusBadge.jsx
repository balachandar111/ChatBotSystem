const LABELS = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  draft: "Draft",
  published: "Published",
  new: "New",
  in_progress: "In progress",
  resolved: "Resolved",
};

export default function StatusBadge({ status }) {
  const cls = { ACTIVE: "active", INACTIVE: "inactive" }[status] || status;
  return <span className={`badge badge-${cls}`}>{LABELS[status] || status}</span>;
}
