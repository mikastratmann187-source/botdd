import { useTickets } from "@/hooks/use-tickets";
import { TicketCard } from "@/components/TicketCard";
import { StatsOverview } from "@/components/StatsOverview";
import { Loader2, Search, Filter, Bell } from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const { data: tickets, isLoading, error } = useTickets();
  const [filter, setFilter] = useState<'all' | 'open' | 'closed' | 'application'>('all');
  const [search, setSearch] = useState('');
  const [lastTicketCount, setLastTicketCount] = useState<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (tickets && lastTicketCount !== null && tickets.length > lastTicketCount) {
      const newTicket = tickets[0]; // Assuming newest is first
      toast({
        title: "🎫 Neues Ticket!",
        description: `Ein neues Ticket von ${newTicket.discordUsername} wurde erstellt.`,
        duration: 5000,
      });
    }
    if (tickets) {
      setLastTicketCount(tickets.length);
    }
  }, [tickets, lastTicketCount, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
          <p className="text-muted-foreground font-medium animate-pulse">Loading tickets...</p>
        </div>
      </div>
    );
  }

  if (error || !tickets) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="glass-card max-w-md w-full p-8 rounded-2xl text-center space-y-4 border-l-4 border-destructive">
          <h2 className="text-xl font-bold text-destructive">Failed to load</h2>
          <p className="text-muted-foreground">Unable to fetch ticket data. Please try again later.</p>
        </div>
      </div>
    );
  }

  const filteredTickets = tickets
    .filter(t => {
      if (filter === 'all') return true;
      if (filter === 'application') return t.type.includes('application');
      return t.status === filter;
    })
    .filter(t => 
      t.discordUsername.toLowerCase().includes(search.toLowerCase()) ||
      t.id.toString().includes(search)
    );

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black text-foreground tracking-tight mb-2">
              Ticket<span className="text-primary">Master</span>
            </h1>
            <p className="text-muted-foreground font-medium">Manage your community support and applications</p>
          </div>
        </header>

        {/* Stats */}
        <StatsOverview tickets={tickets} />

        {/* Filters & Search */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-card/30 p-4 rounded-xl border border-white/5 backdrop-blur-sm">
          <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 no-scrollbar">
            {[
              { id: 'all', label: 'All Tickets' },
              { id: 'open', label: 'Active' },
              { id: 'closed', label: 'Resolved' },
              { id: 'application', label: 'Applications' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id as any)}
                className={`
                  px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all duration-200
                  ${filter === f.id 
                    ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                    : 'bg-background hover:bg-white/5 text-muted-foreground hover:text-foreground'}
                `}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search user or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-background border border-white/10 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-muted-foreground/50"
            />
          </div>
        </div>

        {/* Grid */}
        <motion.div 
          layout
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {filteredTickets.map(ticket => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))}
          
          {filteredTickets.length === 0 && (
            <div className="col-span-full py-20 text-center">
              <div className="w-16 h-16 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Filter className="w-8 h-8 text-muted-foreground/50" />
              </div>
              <h3 className="text-lg font-bold text-muted-foreground">No tickets found</h3>
              <p className="text-sm text-muted-foreground/50">Try adjusting your filters or search terms</p>
            </div>
          )}
        </motion.div>

      </div>
    </div>
  );
}
