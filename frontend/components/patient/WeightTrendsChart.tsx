"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const data = [
  { date: "17/10", weight: 64.2 },
  { date: "18/10", weight: 64.5 },
  { date: "19/10", weight: 64.3 },
  { date: "20/10", weight: 64.8 },
  { date: "21/10", weight: 65.1 },
  { date: "22/10", weight: 64.9 },
  { date: "23/10", weight: 65.2 },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-surface-container-lowest rounded-xl shadow-subtle border border-outline-variant p-2.5 z-20 flex flex-col justify-center">
        <span className="text-[10px] text-on-surface-variant font-semibold mb-1 leading-none text-left">
          {label}
        </span>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-custom-teal"></div>
          <span className="text-on-surface font-bold text-sm leading-none">
            {payload[0].value} kg
          </span>
        </div>
      </div>
    );
  }
  return null;
};

export function WeightTrendsChart() {
  return (
    <section className="bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-subtle p-card-padding relative">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="font-h2 text-h2 text-on-surface font-bold text-lg mb-1">
            Xu hướng cân nặng
          </h2>
          <p className="font-caption text-caption text-on-surface-variant text-xs">
            Theo ngày · 17/10 – 23/10
          </p>
        </div>

        <div className="flex items-center bg-surface-container-low rounded-full p-1 border border-outline-variant/30">
          <button className="px-3 py-1 rounded-full text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/50 transition-colors">
            12M
          </button>
          <button className="px-3 py-1 rounded-full text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/50 transition-colors">
            30D
          </button>
          <button className="px-3 py-1 rounded-full text-xs font-bold bg-surface-container-lowest text-primary shadow-sm border border-outline-variant/20">
            7D
          </button>
        </div>
      </div>

      <div className="w-full h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 0, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2f8f7a" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#2f8f7a" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="0"
              vertical={false}
              stroke="#e2e8f0"
            />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "#3e4945" }}
              dy={10}
            />
            <YAxis
              domain={[64, 66]}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "#3e4945" }}
              tickFormatter={(val) => `${val.toFixed(1)} kg`}
              tickCount={3}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: "#2f8f7a", strokeWidth: 1, strokeDasharray: "3 3" }}
            />
            <Area
              type="monotone"
              dataKey="weight"
              stroke="#2f8f7a"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#colorWeight)"
              activeDot={{ r: 5, fill: "#fff", stroke: "#2f8f7a", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
