/** @file snapshot-cwd.ts
 *
 * CONCEPT of this and other snapshot-* extensions:
 *
 * ...for initial framing or situations we could have the assistant always run a deterministic tool that does a bit of a scan of the workspace. For example to see if there are any existing sessions. Let's assume the tool is going to create a.branch folder when it starts up, but it may not. Maybe the check is: does a.branch folder exist? Are there sessions in the sessions subfolder?
 *
 * Even should we do a preliminary scan of those sessions or at least evaluate initially how long they are? We could count the lines in those sessions and get a sense of, "Oh there are sessions here with significant content or not." That would already tell you something.
 *
 * Another thing might be a quick scan of things like README files. Again not for the content but for the length of the files. That could be done deterministically and could be injected as a very quick kind of initial context injection to say, "Okay in the project where I've been launched there is or isn't pre-existing branch work. There is or isn't pre-existing documentation work of some kind."
 *
 * Initial signals could be just any markdown files gathered out of the space fed to the LLM as a table with a quick scan of how many lines they are or maybe just how many bytes they are. Maybe we don't even count the lines. Something to give a heuristic for either there is substantial documentation or not and otherwise what other kinds of top-level heuristics? Count the number of files that should be a fairly quick run so basically it's like a kick-off heuristic snapshot tool.
 *
 * So, to run with that idea for the moment, I guess there's a series of tools for snapshotting. Snapshot CWD could be the one that is used for that heuristic, and I suppose it could be invocable at different times, discretionally, or it can be automatically invoked following certain deterministic heuristics like:
 * Whether this is the first session in a new specification. In that case, this snapshot will be necessary. Otherwise, other snapshotting tools are going to be Snapshot Graph and Snapshot Nodes at least. The Snapshot Nodes thing is maybe kind of a flexible way to get a range of different snapshots from one single node with only its direct dependencies, or two or more nodes, and/or a variable number of hops to build up a neighborhood
 *
 */
