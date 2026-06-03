/** @file commands.ts
 *
 * NOTES

- can we get skill-like namespaced commands e.g. /brunch:continue, /brunch:switch
	- investigate the source code to figure out how the skill/command matching is done
	- hackable? --would look a little bit more branded
- /continue
	- a slash command that you could use to continue, if interrupted/recovering
	- a system prompt insertion that just says that "if you see the word continue on its own, it means to continue the brunch flow"
	- should set listeners for *any user action that cancels the flow* (like the escape key or whatever)
		- insert a `setStatus` line above the input reminding the user that they can type /continue to re-enter the brunch flow

 */
