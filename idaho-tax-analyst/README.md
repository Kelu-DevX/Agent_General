# Idaho Small Business Tax Analyst (Claude Managed Agent)

A Claude Managed Agent for Perfection Lawns LLC. It researches current federal and Idaho rules from primary sources before it answers, and it can review uploaded books, Jobber exports and receipts.

| File | What it is |
|---|---|
| `agents/idaho-tax-analyst.md` | The agent. YAML frontmatter holds the model, tools and skills. The Markdown body is the system prompt. |
| `environments/idaho-tax-analyst-env.yaml` | The sandbox the agent runs in, including which websites it can reach. |
| `setup_agent.py` | Creates the agent and environment in your Console account, or updates them later. Writes `ids.json`. |
| `chat.py` | A terminal chat with the agent. Can attach files. |

## Configuration

- **Model:** `claude-opus-5-5` at `high` effort.
- **Web search and web fetch:** both on, but limited to primary government and legal sources: irs.gov, all `*.idaho.gov` sites (tax.idaho.gov, legislature.idaho.gov, sos.idaho.gov), ssa.gov, treasury.gov, uscode.house.gov, ecfr.gov, federalregister.gov, govinfo.gov, law.cornell.edu, congress.gov, healthcare.gov, cms.gov, yourhealthidaho.org, sba.gov and dol.gov. Searches are localized to Sandpoint, ID. Blogs and other third-party sites are blocked, so the "prefer primary sources" rule is enforced, not just requested.
- **Sandbox tools:** bash, read, write, edit, glob and grep, under the `auto` permission policy. The server runs calls it judges safe, blocks risky ones, and asks you about anything it can't decide.
- **Skills:** `xlsx` and `pdf`, for spreadsheets, exports and receipts.
- **System prompt:** your original prompt, unchanged, plus a short **YOUR TOOLS** section. That section tells the agent to check today's date, explains where uploaded files are and what the web allow-list covers, and says where to save worksheets.

## 1. Create the agent in your Console account

You need an API key from https://platform.claude.com/settings/keys.

```sh
cd idaho-tax-analyst
pip install anthropic pyyaml
export ANTHROPIC_API_KEY=sk-ant-...
python setup_agent.py
```

The script prints the agent ID and saves it, with the environment ID, to `ids.json`. Commit `ids.json`. The agent then appears under **Agents** in the Console (https://platform.claude.com/agents).

**To change the agent later,** edit `agents/idaho-tax-analyst.md` and run `python setup_agent.py` again. This creates a new version of the same agent, not a duplicate.

**With the `ant` CLI instead:** run `ant apply agents/idaho-tax-analyst.md environments/idaho-tax-analyst-env.yaml`, which reads the same files. Pick one method and stick with it. Each method tracks its own IDs (`ids.json` for the script, `claude-lock.json` for `ant`), so using both creates duplicates.

## 2. Use it

```sh
python chat.py                                              # ask questions
python chat.py --file 2026_jobber_invoices.csv --file Q3_receipts.pdf   # data review
python chat.py --session sesn_...                           # pick up an earlier conversation
```

Each run prints a Console link where you can follow the session live, including each search and fetch the agent makes.

## 3. Widening or narrowing the allowed sites

Every site has to be listed in **both** of these places:

1. `allowed_domains` under `web_search` and `web_fetch` in `agents/idaho-tax-analyst.md`. A plain domain there also covers its subdomains.
2. `allowed_hosts` in `environments/idaho-tax-analyst-env.yaml`. Here you need both `example.gov` and `"*.example.gov"`.

Then run `python setup_agent.py`. To let the agent read any site, including CPA firm blogs and news, remove both `allowed_domains` lists and set `networking: {type: unrestricted}` in the environment file.

## Optional next steps

- **Connect Jobber and Google Drive** with MCP servers so the agent can pull invoices and receipts directly instead of you uploading them. The credentials go in a Console vault and are attached when a session starts.
- **Quarterly reminder run:** a scheduled deployment can check estimated-payment status before each due date (April 15, June 15, September 15 and January 15).
