import type { ReactElement } from "react";

import type { Driver } from "../../types";

interface AssignedVehicleCellProps {
  driver: Driver;
  onOpenAssign: (driver: Driver) => void;
  disabled?: boolean;
}

export default function AssignedVehicleCell({
  driver,
  onOpenAssign,
  disabled = false,
}: AssignedVehicleCellProps): ReactElement {
  const assignedId = driver.assignedVehicleId;
  const isUnassigned = !assignedId;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onOpenAssign(driver);
      }}
      className={`px-3 py-1 rounded-lg transition-colors text-xs font-medium disabled:opacity-60 disabled:cursor-not-allowed ${
        isUnassigned
          ? "bg-blue-500 text-white hover:bg-blue-600"
          : "bg-red-500 text-white hover:bg-red-600"
      }`}
    >
      {isUnassigned ? "Assign" : "Unassign"}
    </button>
  );
}

