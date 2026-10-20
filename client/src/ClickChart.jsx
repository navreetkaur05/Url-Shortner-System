import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function ClickChart({ data }) {
  return (
    <ResponsiveContainer height="100%" minHeight={230} width="100%">
      <AreaChart data={data} margin={{ top: 12, right: 12, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="clickFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#8069eb" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#8069eb" stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#efeff5" strokeDasharray="3 5" vertical={false} />
        <XAxis
          axisLine={false}
          dataKey="date"
          minTickGap={24}
          tickFormatter={(date) => date.slice(5)}
          tick={{ fill: "#9294a5", fontSize: 10 }}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          axisLine={false}
          tick={{ fill: "#9294a5", fontSize: 10 }}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{ border: "1px solid #e9e7f3", borderRadius: 9, fontSize: 12 }}
          labelFormatter={(date) => `Date: ${date}`}
        />
        <Area
          dataKey="clicks"
          fill="url(#clickFill)"
          name="Clicks"
          stroke="#7059e8"
          strokeWidth={2.5}
          type="monotone"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export default ClickChart;
