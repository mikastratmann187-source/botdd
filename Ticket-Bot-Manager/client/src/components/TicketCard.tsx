import { Ticket } from "@shared/schema";
import { format } from "date-fns";
import { 
  MessageCircleQuestion, 
  ShieldAlert, 
  UserPlus, 
  Clock, 
  User, 
  Hash 
} from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";

interface TicketCardProps {
  ticket: Ticket;
}

export function TicketCard({ ticket }: TicketCardProps) {
  const getIcon = () => {
    switch (ticket.type) {
      case "mod_application":
        return <ShieldAlert className="w-5 h-5 text-rose-400" />;
      case "supporter_application":
        return <UserPlus className="w-5 h-5 text-emerald-400" />;
      case "question":
      default:
        return <MessageCircleQuestion className="w-5 h-5 text-primary" />;
    }
  };

  const getTypeLabel = () => {
    switch (ticket.type) {
      case "mod_application": return "Mod App";
      case "supporter_application": return "Supporter App";
      case "question": return "Question";
      default: return ticket.type;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      className="group relative"
    >
      <Link href={`/tickets/${ticket.id}`} className="block h-full">
        <div className="glass-card h-full rounded-2xl p-5 border border-white/5 transition-all duration-300 group-hover:border-primary/50 group-hover:shadow-[0_0_20px_-10px_var(--primary)]">
          
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-background/50 rounded-xl border border-white/5 shadow-inner">
                {getIcon()}
              </div>
              <div>
                <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                  #{ticket.id.toString().padStart(4, '0')}
                </span>
                <h3 className="font-bold text-foreground mt-0.5">{getTypeLabel()}</h3>
              </div>
            </div>
            
            <div className={`
              px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide
              ${ticket.status === 'open' 
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                : 'bg-muted text-muted-foreground border border-white/5'}
            `}>
              {ticket.status}
            </div>
          </div>

          <div className="space-y-2.5 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-primary/70" />
              <span className="truncate">{ticket.discordUsername}</span>
            </div>
            {ticket.discordChannelId && (
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-primary/70" />
                <span className="truncate font-mono text-xs opacity-75">{ticket.discordChannelId}</span>
              </div>
            )}
            <div className="flex items-center gap-2 pt-2 border-t border-white/5">
              <Clock className="w-4 h-4 text-primary/70" />
              <time className="text-xs">
                {ticket.createdAt && format(new Date(ticket.createdAt), "MMM d, yyyy • h:mm a")}
              </time>
            </div>
          </div>

        </div>
      </Link>
    </motion.div>
  );
}
