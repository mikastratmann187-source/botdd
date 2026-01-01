import { useTicket } from "@/hooks/use-tickets";
import { ApplicationAnswers } from "@/components/ApplicationAnswers";
import { Link, useRoute } from "wouter";
import { 
  ArrowLeft, 
  Loader2, 
  MessageCircleQuestion, 
  ShieldAlert, 
  UserPlus,
  User,
  Hash,
  Calendar,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { format } from "date-fns";

export default function TicketDetail() {
  const [, params] = useRoute("/tickets/:id");
  const id = params ? parseInt(params.id) : 0;
  const { data: ticket, isLoading, error } = useTicket(id);

  if (isLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
    </div>
  );

  if (error || !ticket) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Ticket Not Found</h1>
        <Link href="/" className="text-primary hover:underline">Return Dashboard</Link>
      </div>
    </div>
  );

  const getTypeIcon = () => {
    switch (ticket.type) {
      case "mod_application": return <ShieldAlert className="w-8 h-8 text-rose-400" />;
      case "supporter_application": return <UserPlus className="w-8 h-8 text-emerald-400" />;
      default: return <MessageCircleQuestion className="w-8 h-8 text-primary" />;
    }
  };

  const getStatusColor = () => ticket.status === 'open' ? 'text-emerald-400' : 'text-muted-foreground';

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Nav */}
        <Link href="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group">
          <div className="p-2 rounded-full bg-card group-hover:bg-primary/20 group-hover:text-primary transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </div>
          <span className="font-medium">Back to Tickets</span>
        </Link>

        {/* Header Card */}
        <div className="glass-card rounded-2xl overflow-hidden border border-white/5">
          {/* Banner */}
          <div className="h-24 bg-gradient-to-r from-primary/20 via-primary/5 to-transparent border-b border-white/5"></div>
          
          <div className="p-6 sm:p-8 -mt-12 relative">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
              
              <div className="flex items-end gap-4">
                <div className="bg-background p-3 rounded-2xl shadow-xl border border-white/10 ring-4 ring-background">
                  {getTypeIcon()}
                </div>
                <div className="mb-1">
                  <div className="flex items-center gap-2 text-sm font-mono text-muted-foreground/80 mb-1">
                    <span>ID: #{ticket.id.toString().padStart(4, '0')}</span>
                    <span>•</span>
                    <span className="uppercase">{ticket.type.replace(/_/g, ' ')}</span>
                  </div>
                  <h1 className="text-3xl font-bold text-foreground">
                    {ticket.type === 'question' ? 'Support Question' : 'Application Review'}
                  </h1>
                </div>
              </div>

              <div className={`
                flex items-center gap-2 px-4 py-2 rounded-full border bg-background/50 backdrop-blur
                ${ticket.status === 'open' 
                  ? 'border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_-5px_rgba(52,211,153,0.3)]' 
                  : 'border-white/10 text-muted-foreground'}
              `}>
                {ticket.status === 'open' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                <span className="font-bold uppercase tracking-wider text-sm">{ticket.status}</span>
              </div>
            </div>

            {/* Meta Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 pt-6 border-t border-white/5">
              <div className="flex items-center gap-3 text-muted-foreground">
                <div className="p-2 rounded-lg bg-card border border-white/5">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider opacity-60">Submitted By</p>
                  <p className="text-foreground font-semibold">{ticket.discordUsername}</p>
                </div>
              </div>

              {ticket.discordChannelId && (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <div className="p-2 rounded-lg bg-card border border-white/5">
                    <Hash className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider opacity-60">Channel ID</p>
                    <p className="font-mono text-foreground">{ticket.discordChannelId}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 text-muted-foreground">
                <div className="p-2 rounded-lg bg-card border border-white/5">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider opacity-60">Created At</p>
                  <p className="text-foreground">
                    {ticket.createdAt ? format(new Date(ticket.createdAt), "MMM d, yyyy") : "Unknown"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content Section */}
        {ticket.type.includes("application") && (
          <div className="glass-card rounded-2xl p-6 sm:p-8 border border-white/5">
            <ApplicationAnswers ticket={ticket} />
          </div>
        )}

      </div>
    </div>
  );
}
