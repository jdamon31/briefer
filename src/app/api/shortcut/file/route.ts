import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function buildShortcut(captureUrl: string): string {
  const askUuid = 'F3B2A1E9-4C5D-6E7F-8A9B-C0D1E2F30001'

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>WFWorkflowClientRelease</key>
	<string>2.0</string>
	<key>WFWorkflowMinimumClientVersion</key>
	<integer>900</integer>
	<key>WFWorkflowMinimumClientVersionString</key>
	<string>900</string>
	<key>WFWorkflowHasShortcutInputVariables</key>
	<false/>
	<key>WFWorkflowIcon</key>
	<dict>
		<key>WFWorkflowIconGlyphNumber</key>
		<integer>59511</integer>
		<key>WFWorkflowIconStartColor</key>
		<integer>946986751</integer>
	</dict>
	<key>WFWorkflowImportQuestions</key>
	<array/>
	<key>WFWorkflowInputContentItemClasses</key>
	<array/>
	<key>WFWorkflowOutputContentItemClasses</key>
	<array/>
	<key>WFWorkflowTypes</key>
	<array>
		<string>WFSiriType</string>
	</array>
	<key>WFWorkflowActions</key>
	<array>
		<dict>
			<key>WFWorkflowActionIdentifier</key>
			<string>is.workflow.actions.ask</string>
			<key>WFWorkflowActionParameters</key>
			<dict>
				<key>WFAskActionPrompt</key>
				<string>Capture to Briefer</string>
				<key>WFInputType</key>
				<string>Text</string>
				<key>UUID</key>
				<string>${askUuid}</string>
			</dict>
		</dict>
		<dict>
			<key>WFWorkflowActionIdentifier</key>
			<string>is.workflow.actions.downloadurl</string>
			<key>WFWorkflowActionParameters</key>
			<dict>
				<key>WFHTTPMethod</key>
				<string>POST</string>
				<key>WFURL</key>
				<string>${captureUrl}</string>
				<key>WFHTTPBodyType</key>
				<string>File</string>
				<key>WFInput</key>
				<dict>
					<key>Value</key>
					<dict>
						<key>Type</key>
						<string>ActionOutput</string>
						<key>Aggrandizements</key>
						<array/>
						<key>OutputName</key>
						<string>Provided Input</string>
						<key>OutputUUID</key>
						<string>${askUuid}</string>
					</dict>
					<key>WFSerializationType</key>
					<string>WFTokenAttachment</string>
				</dict>
			</dict>
		</dict>
	</array>
</dict>
</plist>`
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('shortcut_token').eq('id', user.id).single()

  let shortcutToken = userData?.shortcut_token
  if (!shortcutToken) {
    const { randomBytes } = await import('crypto')
    shortcutToken = randomBytes(32).toString('hex')
    await supabase.from('users').update({ shortcut_token: shortcutToken }).eq('id', user.id)
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://briefer.vercel.app'
  const captureUrl = `${appUrl}/api/shortcut/capture?t=${encodeURIComponent(shortcutToken)}`
  const xml = buildShortcut(captureUrl)

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'attachment; filename="Briefer.shortcut"',
    },
  })
}
