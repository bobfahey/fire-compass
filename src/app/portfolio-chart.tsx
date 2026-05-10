"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { PortfolioDataPoint } from "@/lib/types";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const shortMoney = (value: number) => {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return money.format(value);
};

export function PortfolioChart({ data }: { data: PortfolioDataPoint[] }) {
  return (
    <section className="rounded-lg border border-zinc-200 p-4">
      <h2 className="mb-3 text-lg font-semibold">Portfolio growth vs. required nest egg</h2>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
          <XAxis dataKey="year" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={shortMoney} width={70} tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={(value) => [typeof value === "number" ? money.format(value) : value, ""]}
            labelFormatter={(label) => `Year: ${label}`}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="projected"
            name="Projected portfolio"
            stroke="#10b981"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="required"
            name="Required nest egg"
            stroke="#f59e0b"
            strokeWidth={2}
            strokeDasharray="6 3"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </section>
  );
}
