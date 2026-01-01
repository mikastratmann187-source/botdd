import { Ticket } from "@shared/schema";
import { 
  Inbox, 
  Clock, 
  CheckCircle2, 
  AlertCircle 
} from "lucide-react";

interface StatsOverviewProps {
  tickets: Ticket[];
}

export function StatsOverview({ tickets }: StatsOverviewProps) {
  const open = tickets.filter(t => t.status === "open").length;
  const closed = tickets.filter(t => t.status === "closed").length;
  const total = tickets.length;
  const applications = tickets.filter(t => t.type.includes("application")).length;

  const stats = [
    {
      label: "Total Tickets",
      value: total,
      icon: Inbox,
      color: "text-blue-400",
      bg: "bg-blue-400/10"
    },
    {
      label: "Active / Open",
      value: open,
      icon: AlertCircle,
      color: "text-emerald-400",
      bg: "bg-emerald-400/10"
    },
    {
      label: "Applications",
      value: applications,
      icon: Clock,
      color: "text-purple-400",
      bg: "bg-purple-400/10"
    },
    {
      label: "Resolved",
      value: closed,
      icon: CheckCircle2,
      color: "text-muted-foreground",
      bg: "bg-muted/50"
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, i) => (
        <div key={i} className="glass-card p-5 rounded-xl border border-white/5">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${stat.bg}`}>
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">{stat.label}</p>
              <h4 className="text-2xl font-bold font-display mt-0.5">{stat.value}</h4>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
