import { AgentConsole } from "@/components/agent-console";
import { serviceNames } from "@/data/catalog";

export default function Home() {
  return <AgentConsole serviceNames={[...serviceNames]} />;
}
