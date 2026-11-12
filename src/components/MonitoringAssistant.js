"use client";
import { useEffect, useRef, useState } from "react";
import { Bot, ExternalLink, MessageCircle, Send, X } from "lucide-react";
import { api, usePoll } from "@/lib/useApi";

const SUGGESTIONS = ["Summarize system health", "Is the internet working?", "What should I check first?"];

function websiteFromText(text) {
  const match = text.match(/(?:https?:\/\/|www\.)[^\s<>"']+|[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9-]+)+(?:\/[^\s<>"']*)?/i);
  if (!match) return null;
  const raw = match[0].replace(/[),.!?;:]+$/, "");
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname || url.username || url.password) return null;
    return { url: url.href, name: url.hostname.replace(/^www\./i, "") };
  } catch {
    return null;
  }
}

function normalizedUrl(value) {
  try {
    return new URL(value).href.toLowerCase();
  } catch {
    return null;
  }
}

function answerQuestion(question, telemetry, health, network) {
  const text = question.toLowerCase();
  const latest = telemetry.data?.latest;
  const findings = health.data?.findings || [];
  const status = health.data?.status || "No data";

  if (!latest) {
    return "I don't have a sensor reading yet. Start `python sensor\\om_sensor.py` in a terminal and leave it running. The dashboard will update when readings arrive.";
  }

  if (/(internet|provider|isp|connection|online|offline|wifi|wi-fi)/.test(text)) {
    const name = network.data?.connectionName || "Internet connection";
    const target = network.data?.checkTarget || "the configured check address";
    const internetIssue = findings.find((item) => item.metric === "internet_loss" || item.metric === "internet_latency");
    if (latest.internet_latency == null || (latest.internet_loss ?? 0) >= 100) {
      return `${name} (${network.data?.providerName || "provider not configured"}): the check to ${target} did not get a reply. The gateway check can help tell whether this is a local network issue or an upstream internet issue.`;
    }
    if (internetIssue) {
      return `${name} (${network.data?.providerName || "provider not configured"}) is responding, but there is an internet warning: ${internetIssue.explanation} Current response time is ${latest.internet_latency} ms to ${target}.`;
    }
    return `${name} (${network.data?.providerName || "provider not configured"}) is responding. The check to ${target} took ${latest.internet_latency} ms. This only confirms the configured check target responds; it does not automatically identify or verify the ISP.`;
  }

  if (/(gateway|router|local network|packet loss)/.test(text)) {
    const issue = findings.find((item) => item.metric === "router_loss" || item.metric === "router_latency");
    if (latest.router_latency == null && (latest.router_loss ?? 0) >= 100) {
      return `The gateway at ${network.data?.gatewayTarget || "the configured address"} did not reply to pings. Check that the gateway address is correct in Settings, then check Wi-Fi or the network cable.`;
    }
    if (issue) {
      return `The gateway check needs attention: ${issue.explanation} Current latency: ${latest.router_latency ?? "unavailable"} ms; packet loss: ${latest.router_loss ?? "unavailable"}%.`;
    }
    return `The gateway is responding normally: ${latest.router_latency ?? "unavailable"} ms latency and ${latest.router_loss ?? "unavailable"}% packet loss.`;
  }

  if (/(website|web page|site|http)/.test(text)) {
    const issue = findings.find((item) => item.metric === "web_status" || item.metric === "web_latency");
    if (issue) return `The monitored website ${network.data?.websiteTarget || ""} needs attention: ${issue.explanation} Latest HTTP status: ${latest.web_status || "no reply"}.`;
    if (!latest.web_status) return `The monitored website ${network.data?.websiteTarget || ""} did not reply. Check the URL in Settings or open the website separately to see whether it is available.`;
    return `The monitored website is responding with HTTP ${latest.web_status} in ${latest.web_latency ?? "unknown"} ms.`;
  }

  if (/(cpu|processor|memory|ram)/.test(text)) {
    const cpuIssue = findings.find((item) => item.metric === "cpu");
    const ramIssue = findings.find((item) => item.metric === "ram");
    const details = `CPU is ${latest.cpu ?? "unavailable"}%; memory is ${latest.ram ?? "unavailable"}%.`;
    const issues = [cpuIssue, ramIssue].filter(Boolean);
    return issues.length
      ? `${details} ${issues.map((item) => item.explanation).join(" ")}`
      : `${details} Neither is currently over its alert threshold.`;
  }

  if (/(what should|what do i|what to|next step|fix|help|first)/.test(text)) {
    const issue = findings[0];
    return issue
      ? `Start with "${issue.label}". ${issue.explanation}`
      : "No current findings need attention. Keep the Python sensor running, and use Settings to confirm the connection name, gateway, and website are correct.";
  }

  if (/(risk|score|status|health|summar|problem|issue|alert)/.test(text)) {
    const summary = findings.length
      ? findings.map((item) => `${item.label}: ${item.explanation}`).join("\n")
      : "No threshold or unusual-reading findings are currently reported.";
    return `System status: ${status} (risk score ${health.data?.score ?? 0}/100). ${summary}`;
  }

  if (/(latency|ping|ms|slow)/.test(text)) {
    return `Latency is the time a check takes to get a reply; lower is generally better. Current gateway: ${latest.router_latency ?? "no reply"} ms; internet check: ${latest.internet_latency ?? "no reply"} ms; website: ${latest.web_latency ?? "no reply"} ms.`;
  }

  if (/(packet|loss)/.test(text)) {
    return `Packet loss is the percentage of test packets that did not get a reply. Current gateway loss: ${latest.router_loss ?? "unavailable"}%; internet-check loss: ${latest.internet_loss ?? "unavailable"}%.`;
  }

  return "I can explain the current system health, internet connection, gateway, website, CPU, memory, latency, or packet loss. Try one of the suggested questions below.";
}

export default function MonitoringAssistant() {
  const telemetry = usePoll("/api/telemetry?limit=1");
  const health = usePoll("/api/ai-inference");
  const network = usePoll("/api/network/config", 30000);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [pendingWebsite, setPendingWebsite] = useState(null);
  const [websiteBusy, setWebsiteBusy] = useState(false);
  const [websiteMessage, setWebsiteMessage] = useState("");
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Hi! I can explain your live monitoring readings and suggest what to check. Your questions and readings stay in this app." },
  ]);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, open]);

  function ask(question) {
    const trimmed = question.trim();
    if (!trimmed) return;
    const website = websiteFromText(trimmed);
    if (website) {
      setPendingWebsite(website);
      setWebsiteMessage("");
      setMessages((current) => [
        ...current,
        { role: "user", text: trimmed },
        { role: "assistant", text: `I found ${website.url}. Add it to monitored assets? The sensor will check it on its next cycle. Only add sites you are authorized to monitor.` },
      ]);
      setInput("");
      return;
    }
    const reply = answerQuestion(trimmed, telemetry, health, network);
    setMessages((current) => [
      ...current,
      { role: "user", text: trimmed },
      { role: "assistant", text: reply },
    ]);
    setInput("");
  }

  async function addWebsite() {
    if (!pendingWebsite || websiteBusy) return;
    setWebsiteBusy(true);
    setWebsiteMessage("");
    try {
      const assets = await api("/api/assets");
      const alreadyAdded = assets.some((asset) =>
        asset.url && normalizedUrl(asset.url) === normalizedUrl(pendingWebsite.url)
      );
      if (alreadyAdded) {
        setWebsiteMessage("This website is already in monitored assets.");
        setPendingWebsite(null);
        return;
      }
      await api("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: pendingWebsite.name,
          type: "Website",
          environment: "Prod",
          url: pendingWebsite.url,
        }),
      });
      await health.reload();
      setWebsiteMessage(`${pendingWebsite.name} was added. The sensor will check it on its next cycle.`);
      setPendingWebsite(null);
    } catch (error) {
      setWebsiteMessage(`Could not add this website: ${error.message}`);
    } finally {
      setWebsiteBusy(false);
    }
  }

  return (
    <div className="assistant">
      {open && (
        <section className="assistant-panel" aria-label="Monitoring help chat">
          <header className="assistant-header">
            <div className="assistant-title">
              <span className="assistant-avatar"><Bot size={18} /></span>
              <div><b>Monitoring help</b><small>Answers from your live dashboard</small></div>
            </div>
            <button className="assistant-icon" type="button" onClick={() => setOpen(false)} aria-label="Close chat"><X size={18} /></button>
          </header>
          <div className="assistant-messages" role="log" aria-live="polite" aria-relevant="additions">
            {messages.map((message, index) => (
              <div className={`assistant-message ${message.role}`} key={`${index}-${message.role}`}>
                {message.text}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          {pendingWebsite && (
            <div className="assistant-website">
              <span><ExternalLink size={15} /> Website to monitor</span>
              <strong>{pendingWebsite.url}</strong>
              <button className="btn" type="button" onClick={addWebsite} disabled={websiteBusy}>
                {websiteBusy ? "Adding..." : "Add to monitoring"}
              </button>
              <button className="assistant-cancel" type="button" onClick={() => { setPendingWebsite(null); setWebsiteMessage(""); }}>
                Cancel
              </button>
            </div>
          )}
          {websiteMessage && <div className="assistant-website-message" role="status">{websiteMessage}</div>}
          <div className="assistant-suggestions">
            {SUGGESTIONS.map((suggestion) => (
              <button type="button" key={suggestion} onClick={() => ask(suggestion)}>{suggestion}</button>
            ))}
          </div>
          <form className="assistant-compose" onSubmit={(event) => { event.preventDefault(); ask(input); }}>
            <input
              aria-label="Ask about monitoring"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about your monitoring..."
            />
            <button className="assistant-send" type="submit" disabled={!input.trim()} aria-label="Send question"><Send size={17} /></button>
          </form>
          <div className="assistant-note">Built-in helper · no external AI service</div>
        </section>
      )}
      <button
        className="assistant-launch"
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? "Close monitoring help" : "Open monitoring help"}
      >
        {open ? <X size={20} /> : <MessageCircle size={20} />}
        <span>{open ? "Close help" : "Ask for help"}</span>
      </button>
    </div>
  );
}
