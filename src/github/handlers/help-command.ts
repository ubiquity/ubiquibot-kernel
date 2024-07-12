import { getConfig } from "../utils/config";
import { GithubPlugin } from "../types/plugin-configuration";
import { GitHubContext } from "../github-context";
import { manifestSchema, manifestValidator } from "../../types/manifest";
import { Value } from "@sinclair/typebox/value";
import { getManifest } from "../utils/plugins";

async function parseCommandsFromManifest(context: GitHubContext<"issue_comment.created">, plugin: string | GithubPlugin) {
  const commands: string[] = [];
  const manifest = await getManifest(context, plugin);
  if (manifest) {
    Value.Default(manifestSchema, manifest);
    const errors = manifestValidator.testReturningErrors(manifest);
    if (errors !== null) {
      console.error(`Failed to load the manifest for ${JSON.stringify(plugin)}`);
      for (const error of errors) {
        console.error(error);
      }
    } else {
      if (manifest?.commands) {
        for (const [key, value] of Object.entries(manifest.commands)) {
          commands.push(`| \`/${getContent(key)}\` | ${getContent(value.description)} | \`${getContent(value["ubiquibot:example"])}\` |`);
        }
      }
    }
  }
  return commands;
}

export async function postHelpCommand(context: GitHubContext<"issue_comment.created">) {
  const comments = [
    "### Available Commands\n\n",
    "| Command | Description | Example |",
    "|---|---|---|",
    "| `/help` | List all available commands. | `/help` |",
  ];
  const commands: string[] = [];
  const configuration = await getConfig(context);
  for (const pluginArray of Object.values(configuration.plugins)) {
    for (const pluginElement of pluginArray) {
      const { plugin } = pluginElement.uses[0];
      commands.push(...(await parseCommandsFromManifest(context, plugin)));
    }
  }
  await context.octokit.issues.createComment({
    body: comments.concat(commands.sort()).join("\n"),
    issue_number: context.payload.issue.number,
    owner: context.payload.repository.owner.login,
    repo: context.payload.repository.name,
  });
}

/**
 * Ensures that passed content does not break MD display within the table.
 */
function getContent(content: string | undefined) {
  return content ? content.replace("|", "\\|") : "-";
}
