import { isAuthed, unauthorized } from "@/lib/auth";
import { readJson, writeJson } from "@/lib/paths";

export const dynamic = "force-dynamic";
const FILE = "config.json";

function toResponse(config) {
  return {
    connectionName: config.connection_name || "Office internet",
    providerName: config.isp_name || "",
    gatewayTarget: config.router_ip || "192.168.1.1",
    checkTarget: config.dns_ip || "8.8.8.8",
    websiteTarget: config.website_url || "https://www.oldmutual.co.rw",
  };
}

function validHost(value) {
  return value.length <= 253 && /^[a-zA-Z0-9.-]+$/.test(value) &&
    value.split(".").every((part) => part.length > 0 && part.length <= 63 && !part.startsWith("-") && !part.endsWith("-"));
}

function validWebsite(value) {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") &&
      Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export async function GET(request) {
  if (!isAuthed(request)) return unauthorized();
  return Response.json(toResponse(readJson(FILE, {})));
}

export async function POST(request) {
  if (!isAuthed(request)) return unauthorized();
  const body = await request.json();
  const connectionName = String(body.connectionName || "").trim();
  const providerName = String(body.providerName || "").trim();
  const gatewayTarget = String(body.gatewayTarget || "").trim();
  const checkTarget = String(body.checkTarget || "").trim();
  const websiteTarget = String(body.websiteTarget || "").trim();
  if (!connectionName || connectionName.length > 100 || providerName.length > 100) {
    return Response.json({ error: "Enter a connection name (up to 100 characters). The provider name can be left blank." }, { status: 400 });
  }
  if (!validHost(gatewayTarget) || !validHost(checkTarget)) {
    return Response.json({ error: "Enter a valid host name or IP address for the gateway and internet check." }, { status: 400 });
  }
  if (!validWebsite(websiteTarget)) {
    return Response.json({ error: "Enter a valid website URL starting with http:// or https://." }, { status: 400 });
  }

  const config = readJson(FILE, {});
  writeJson(FILE, {
    ...config,
    connection_name: connectionName,
    isp_name: providerName,
    router_ip: gatewayTarget,
    dns_ip: checkTarget,
    website_url: websiteTarget,
  });
  return Response.json(toResponse({
    ...config,
    connection_name: connectionName,
    isp_name: providerName,
    router_ip: gatewayTarget,
    dns_ip: checkTarget,
    website_url: websiteTarget,
  }));
}
