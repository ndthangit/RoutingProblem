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
import PlaylistAddCheckIcon from "@mui/icons-material/PlaylistAddCheck";

import type { Plan } from "../../types";

interface PlanDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: Plan | null;
}

function formatDate(value?: string | number | null): string {
  if (value === null || value === undefined || value === "") return "N/A";
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
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

export default function PlanDetailsModal({ isOpen, onClose, plan }: PlanDetailsModalProps) {
  const stops = Array.isArray(plan?.points) ? plan!.points!.length : 0;

  return (
    <Dialog open={isOpen} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <PlaylistAddCheckIcon sx={{ color: "primary.main" }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Plan details
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {plan?.id ?? ""}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small" aria-label="Close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {!plan ? (
          <Typography variant="body2" color="text.secondary">
            No plan selected.
          </Typography>
        ) : (
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              Summary
            </Typography>
            <FieldRow label="ID" value={plan.id} />
            <FieldRow label="Vehicle" value={plan.vehicleId} />
            <FieldRow label="Status" value={plan.status} />
            <FieldRow label="Origin" value={plan.origin} />
            <FieldRow label="Destination" value={plan.destination} />
            <FieldRow label="Stops" value={stops} />
            <FieldRow label="Note" value={plan.note} />

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              Timing
            </Typography>
            <FieldRow label="Start time" value={formatDate(plan.startTime ?? null)} />
            <FieldRow label="End time" value={formatDate(plan.endTime ?? null)} />
            <FieldRow label="Created at" value={formatDate(plan.createdAt ?? null)} />
            <FieldRow label="Updated at" value={formatDate(plan.updatedAt ?? null)} />

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              Stops detail
            </Typography>
            {Array.isArray(plan.points) && plan.points.length ? (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {plan.points.map((p, idx) => (
                  <Box
                    key={String(p.id ?? idx)}
                    sx={{
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 1,
                      p: 1.5,
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      Stop {idx + 1}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {String(p.name ?? p.address ?? p.id ?? "N/A")}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {p.coordinate ? `${p.coordinate.lat}, ${p.coordinate.lon}` : ""}
                    </Typography>
                  </Box>
                ))}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No stops.
              </Typography>
            )}
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

