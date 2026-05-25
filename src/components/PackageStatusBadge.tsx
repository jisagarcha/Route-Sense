import { Badge } from "@/components/ui/badge";

interface PackageStatusBadgeProps {
  status: string;
  className?: string;
}

const statusClasses: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-800 border-gray-200",
  ASSIGNED: "bg-blue-100 text-blue-800 border-blue-200",
  COLLECTED_FROM_WAREHOUSE: "bg-yellow-100 text-yellow-900 border-yellow-200",
  IN_TRANSIT: "bg-orange-100 text-orange-900 border-orange-200",
  DELIVERED: "bg-green-100 text-green-800 border-green-200",
  FAILED: "bg-red-100 text-red-800 border-red-200",
  CANCELLED: "bg-red-100 text-red-800 border-red-200",
};

export function PackageStatusBadge({ status, className }: PackageStatusBadgeProps) {
  return (
    <Badge className={`${statusClasses[status] || "bg-gray-100 text-gray-800 border-gray-200"} ${className || ""}`}>
      {status.replaceAll("_", " ")}
    </Badge>
  );
}
