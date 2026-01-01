import { z } from "zod";
import { insertTicketSchema, tickets } from "./schema";

export const api = {
  tickets: {
    list: {
      method: "GET" as const,
      path: "/api/tickets",
      responses: {
        200: z.array(z.custom<typeof tickets.$inferSelect>()),
      },
    },
    get: {
      method: "GET" as const,
      path: "/api/tickets/:id",
      responses: {
        200: z.custom<typeof tickets.$inferSelect>(),
        404: z.object({ message: z.string() }),
      },
    },
    updateStatus: {
      method: "PATCH" as const,
      path: "/api/tickets/:id/status",
      input: z.object({ status: z.string() }),
      responses: {
        200: z.custom<typeof tickets.$inferSelect>(),
        404: z.object({ message: z.string() }),
      },
    },
    claim: {
      method: "POST" as const,
      path: "/api/tickets/:id/claim",
      input: z.object({ userId: z.string(), username: z.string() }),
      responses: {
        200: z.custom<typeof tickets.$inferSelect>(),
        404: z.object({ message: z.string() }),
      },
    },
    close: {
      method: "POST" as const,
      path: "/api/tickets/:id/close",
      responses: {
        200: z.custom<typeof tickets.$inferSelect>(),
        404: z.object({ message: z.string() }),
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
