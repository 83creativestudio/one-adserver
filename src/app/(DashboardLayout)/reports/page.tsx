"use client";

import { useEffect, useState } from "react";
import { Alert, Box, Card, CardContent, Chip, LinearProgress, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from "@mui/material";

type CampaignReport = { id: string; name: string; advertiser: string; status: string; start_at: string; end_at: string; requests: number; impressions: number; clicks: number };
type Metrics = { noFill: number; totals: Record<string, number>; daily: { day: string; kind: string; value: number }[]; campaigns: CampaignReport[]; generatedAt: string };
type DeliveryState = "active" | "paused" | "scheduled" | "ended";

function deliveryState(campaign: CampaignReport, today: string): DeliveryState {
  if (campaign.end_at && campaign.end_at < today) return "ended";
  if (campaign.status !== "active") return "paused";
  if (campaign.start_at && campaign.start_at > today) return "scheduled";
  return "active";
}

const stateLabels: Record<DeliveryState, string> = { active: "Active", paused: "Paused", scheduled: "Scheduled", ended: "Ended" };

export default function Reports() {
  const [data, setData] = useState<Metrics | null>(null);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState<DeliveryState | "all">("all");

  useEffect(() => {
    let mounted = true;
    const load = () => {
      if (document.visibilityState === "hidden") return;
      void fetch("/api/admin/metrics", { cache: "no-store" })
        .then(response => { if (!response.ok) throw new Error("Could not load reports"); return response.json(); })
        .then(result => { if (mounted) { setData(result); setError(false); } })
        .catch(() => { if (mounted) setError(true); });
    };
    load();
    const timer = window.setInterval(load, 30_000);
    document.addEventListener("visibilitychange", load);
    return () => { mounted = false; window.clearInterval(timer); document.removeEventListener("visibilitychange", load); };
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const campaigns = (data?.campaigns || []).filter(campaign => {
    const matchesSearch = `${campaign.name} ${campaign.advertiser}`.toLowerCase().includes(search.toLowerCase().trim());
    return matchesSearch && (stateFilter === "all" || deliveryState(campaign, today) === stateFilter);
  });
  const days = Object.values((data?.daily || []).reduce<Record<string, { day: string; request: number; impression: number; click: number }>>((acc, row) => {
    acc[row.day] ??= { day: row.day, request: 0, impression: 0, click: 0 };
    if (row.kind in acc[row.day]) acc[row.day][row.kind as "request" | "impression" | "click"] = row.value;
    return acc;
  }, {})).reverse();
  const fillRate = data?.totals.request ? ((data.totals.request - data.noFill) / data.totals.request * 100).toFixed(1) : "0.0";

  return <Box sx={{ py: 3 }}>
    <Typography variant="h4" fontWeight={800}>Reports</Typography>
    <Typography color="text.secondary" mt={.5} mb={3}>All campaigns and their lifetime delivery results.</Typography>
    {error && <Alert severity="error" sx={{ mb: 3 }}>Could not load reports. Refresh the page to try again.</Alert>}
    {!data && !error && <LinearProgress sx={{ mb: 3 }} />}
    {data && <Box mb={3}><Typography>Campaigns: {data.campaigns.length.toLocaleString()} · No-fill requests: {data.noFill.toLocaleString()} · Fill rate: {fillRate}%</Typography><Typography variant="caption" color="text.secondary">Updated {new Date(data.generatedAt).toLocaleString()} · Refreshes about every minute</Typography></Box>}

    <Stack spacing={3}>
      <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} gap={2} mb={2}>
            <Box>
              <Typography variant="h6" fontWeight={800}>Campaign performance</Typography>
              <Typography variant="body2" color="text.secondary">Lifetime totals for every campaign, including campaigns with no activity.</Typography>
            </Box>
            <Stack direction={{ xs: "column", sm: "row" }} gap={1.5}>
              <TextField size="small" label="Search campaigns" value={search} onChange={event => setSearch(event.target.value)} />
              <TextField select size="small" label="Delivery state" value={stateFilter} onChange={event => setStateFilter(event.target.value as DeliveryState | "all")} sx={{ minWidth: 150 }}>
                <MenuItem value="all">All states</MenuItem><MenuItem value="active">Active</MenuItem><MenuItem value="paused">Paused</MenuItem><MenuItem value="scheduled">Scheduled</MenuItem><MenuItem value="ended">Ended</MenuItem>
              </TextField>
            </Stack>
          </Stack>
          {data && <Typography variant="body2" color="text.secondary" mb={1}>Showing {campaigns.length.toLocaleString()} of {data.campaigns.length.toLocaleString()} campaigns</Typography>}
          <TableContainer><Table sx={{ minWidth: 960 }}>
            <TableHead><TableRow>
              <TableCell>Campaign</TableCell><TableCell>Advertiser</TableCell><TableCell>Delivery state</TableCell><TableCell>Start</TableCell><TableCell>End</TableCell>
              <TableCell align="right">Served requests</TableCell><TableCell align="right">Impressions</TableCell><TableCell align="right">Clicks</TableCell><TableCell align="right">CTR</TableCell>
            </TableRow></TableHead>
            <TableBody>{campaigns.length ? campaigns.map(campaign => {
              const state = deliveryState(campaign, today);
              return <TableRow key={campaign.id} hover>
                <TableCell sx={{ fontWeight: 700 }}>{campaign.name}</TableCell><TableCell>{campaign.advertiser}</TableCell>
                <TableCell><Chip size="small" label={stateLabels[state]} color={state === "active" ? "success" : state === "ended" ? "warning" : "default"} /></TableCell>
                <TableCell>{campaign.start_at || "Any time"}</TableCell><TableCell>{campaign.end_at || "No end"}</TableCell>
                <TableCell align="right">{campaign.requests.toLocaleString()}</TableCell><TableCell align="right">{campaign.impressions.toLocaleString()}</TableCell><TableCell align="right">{campaign.clicks.toLocaleString()}</TableCell>
                <TableCell align="right">{campaign.impressions ? (campaign.clicks / campaign.impressions * 100).toFixed(2) : "0.00"}%</TableCell>
              </TableRow>;
            }) : <TableRow><TableCell colSpan={9} align="center" sx={{ py: 5 }}>{error ? "Reports are unavailable." : data?.campaigns.length ? "No campaigns match these filters." : data ? "No campaigns yet." : "Loading campaigns…"}</TableCell></TableRow>}</TableBody>
          </Table></TableContainer>
          <Typography variant="caption" color="text.secondary">Served requests exclude no-fill requests, which are counted above for the whole ad server. Dates and delivery state use UTC.</Typography>
        </CardContent>
      </Card>

      <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={800} mb={2}>Daily activity</Typography>
          <TableContainer><Table><TableHead><TableRow><TableCell>Date (UTC)</TableCell><TableCell align="right">Requests</TableCell><TableCell align="right">Impressions</TableCell><TableCell align="right">Clicks</TableCell></TableRow></TableHead>
            <TableBody>{days.length ? days.map(row => <TableRow key={row.day}><TableCell>{row.day}</TableCell><TableCell align="right">{row.request.toLocaleString()}</TableCell><TableCell align="right">{row.impression.toLocaleString()}</TableCell><TableCell align="right">{row.click.toLocaleString()}</TableCell></TableRow>) : <TableRow><TableCell colSpan={4} align="center" sx={{ py: 5 }}>{error ? "Daily activity is unavailable." : data ? "No delivery events in the last 14 days." : "Loading daily activity…"}</TableCell></TableRow>}</TableBody>
          </Table></TableContainer>
        </CardContent>
      </Card>
    </Stack>
  </Box>;
}
