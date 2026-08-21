import { describeGateway, listGatewayModels, readGatewayConfig } from "../../../lib/truefoundry.mjs";
import { AI_FEATURES } from "../../../lib/governance.mjs";

/**
 * Secret-free description of the TrueFoundry account this deployment is
 * connected to: the model chain in use, every model the account can actually
 * reach, the policy each AI feature runs under, and where to go to add more.
 *
 * Sologurus ships no provider list of its own. Whatever an administrator has
 * connected in their own control plane is what appears here.
 */
export async function GET() {
  const config = readGatewayConfig();
  const gateway = describeGateway(config);
  const listing = await listGatewayModels({ config });

  return Response.json(
    {
      gateway,
      models: listing.models,
      modelsOk: listing.ok,
      modelsError: listing.error,
      features: AI_FEATURES.map((feature) => ({
        id: feature.id,
        label: feature.label,
        purpose: feature.purpose,
        dailyCallCeiling: feature.dailyCallCeiling,
        dailyTokenCeiling: feature.dailyTokenCeiling,
        sendsLearnerProse: feature.sendsLearnerProse,
        promptLogging: feature.promptLogging,
      })),
      privacy: [
        "Requests carry a pseudonymous learner id, never a name, an email, or exact coordinates.",
        "Learner prose is redacted server-side before it reaches the gateway, independently of the gateway guardrail.",
        "Prompt logging is disabled for any feature that carries learner writing.",
        "Registration links and test-centre addresses are rendered from the curated catalog, never from model output.",
      ],
      degradedMode: gateway.configured
        ? "Connected. Model failures fall back down the chain, then to the deterministic planner."
        : "Not connected to a TrueFoundry account. Sologurus runs its deterministic planner and labels every AI panel as offline.",
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
