import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import WarehouseIcon from "@mui/icons-material/Warehouse";

import type { Warehouse } from "../../types";

interface WarehouseDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  warehouse: Warehouse | null;
}

function formatDate(value?: string | number): string {
  if (value === null || value === undefined || value === "") return "N/A";
  if (typeof value === "number") {
	const d = new Date(value);
	return isNaN(d.getTime()) ? String(value) : d.toLocaleString();
  }

  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function FieldRow({ label, value }: { label: string; value?: React.ReactNode }) {
  const display = value === null || value === undefined || value === "" ? "N/A" : value;
  return (
	<Box sx={{ display: "flex", gap: 2, py: 0.75 }}>
	  <Typography sx={{ width: 220, color: "text.secondary", fontWeight: 600 }} variant="body2">
		{label}
	  </Typography>
	  <Typography sx={{ flex: 1 }} variant="body2">
		{display}
	  </Typography>
	</Box>
  );
}

export default function WarehouseDetailsModal({ isOpen, onClose, warehouse }: WarehouseDetailsModalProps) {
  return (
	<Dialog open={isOpen} onClose={onClose} fullWidth maxWidth="md">
	  <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
		<WarehouseIcon sx={{ color: "primary.main" }} />
		<Box sx={{ flex: 1 }}>
		  <Typography variant="h6" sx={{ fontWeight: 700 }}>
			Warehouse details
		  </Typography>
		  <Typography variant="body2" color="text.secondary">
			{warehouse?.name ?? ""}
		  </Typography>
		</Box>
		<IconButton onClick={onClose} size="small" aria-label="Close">
		  <CloseIcon />
		</IconButton>
	  </DialogTitle>

	  <DialogContent dividers>
		{!warehouse ? (
		  <Typography variant="body2" color="text.secondary">
			No warehouse selected.
		  </Typography>
		) : (
		  <Box>
			<Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
			  Basic
			</Typography>
			<FieldRow label="ID" value={warehouse.id} />
			<FieldRow label="Name" value={warehouse.name} />
			<FieldRow label="Address" value={warehouse.address} />
			<FieldRow label="Type" value={warehouse.warehouseType} />
			<FieldRow label="Status" value={warehouse.status} />

			<Divider sx={{ my: 2 }} />

			<Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
			  Capacity & Ownership
			</Typography>
			<FieldRow label="Capacity" value={warehouse.capacity} />
			<FieldRow label="Manager ID" value={warehouse.managerId} />

			<Divider sx={{ my: 2 }} />

			<Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
			  Location
			</Typography>
			<FieldRow
			  label="Coordinate"
			  value={warehouse.coordinate ? `${warehouse.coordinate.lat}, ${warehouse.coordinate.lon}` : "N/A"}
			/>
			<FieldRow label="Contact phone" value={warehouse.contactPhone} />

			<Divider sx={{ my: 2 }} />

			<Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
			  Metadata
			</Typography>
			<FieldRow label="Created at" value={formatDate(warehouse.createdAt as string | number | undefined)} />
			<FieldRow label="Updated at" value={formatDate(warehouse.updatedAt as string | number | undefined)} />
		  </Box>
		)}
	  </DialogContent>

	  <DialogActions>
		<Button onClick={onClose} variant="contained">
		  Close
		</Button>
	  </DialogActions>
	</Dialog>
  );
}



