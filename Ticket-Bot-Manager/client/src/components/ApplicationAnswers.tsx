import { Ticket } from "@shared/schema";
import { motion } from "framer-motion";

interface ApplicationAnswersProps {
  ticket: Ticket;
}

export function ApplicationAnswers({ ticket }: ApplicationAnswersProps) {
  if (!ticket.answers || !ticket.type.includes("application")) return null;

  // Assume answers is a JSON object of key-value pairs
  const answers = ticket.answers as Record<string, string>;

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold font-display text-primary flex items-center gap-2">
        <span className="w-1 h-6 bg-primary rounded-full"></span>
        Application Responses
      </h3>
      
      <div className="grid gap-6">
        {Object.entries(answers).map(([question, answer], i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="group"
          >
            <div className="text-sm font-medium text-muted-foreground mb-2 pl-1 border-l-2 border-primary/30">
              {question}
            </div>
            <div className="bg-card/50 p-4 rounded-xl border border-white/5 text-foreground leading-relaxed shadow-sm group-hover:bg-card/80 transition-colors">
              {answer || <span className="text-muted-foreground italic">No answer provided</span>}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
