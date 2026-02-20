import { executeFunctionCall } from '@/lib/execute-function'
import { functionTools } from '@/lib/function-tools'
import { GoogleGenAI } from '@google/genai'
import { NextRequest, NextResponse } from 'next/server'

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

// Format document with line numbers for AI context
function formatDocumentForAI(content: string): string {
    if (!content) return '(empty document)'
    const lines = content.split('\n')
    return lines.map((line, i) => `${i + 1}. ${line}`).join('\n')
}

export async function POST(request: NextRequest) {
    try {
        const { messages, documentContent, file } = await request.json()

        // CRITICAL: Always give AI the current document state with line numbers
        const documentWithLines = formatDocumentForAI(documentContent)
        const lineCount = documentContent ? documentContent.split('\n').length : 0

        const systemPrompt = `You are a helpful AI assistant for a document editor. You help users edit their documents.

**CURRENT DOCUMENT (${lineCount} lines):**
\`\`\`
${documentWithLines}
\`\`\`

You have tools to manipulate the document. When the user asks you to edit:
1. Look at the line numbers above carefully
2. Use the appropriate tool with correct line numbers
3. Be precise with line numbers

If the document is empty and user wants to add content, use append_to_document.
If the user asks to change specific lines, use update_doc_by_line.
If the user asks to find and replace text, use update_doc_by_replace.
If the user asks to insert text, use insert_at_line.
If the user asks to delete lines, use delete_lines.

Always confirm what you did after making changes. Respond in the same language the user uses.`

        // Build the conversation history for Gemini
        const contents: any[] = [
            { role: 'user', parts: [{ text: systemPrompt }] },
            { role: 'model', parts: [{ text: 'Understood! I can see the current document and I\'m ready to help you edit it. What would you like me to do?' }] },
        ]

        // Add previous messages (skip last one, we'll add it separately)
        for (const m of messages.slice(0, -1)) {
            contents.push({
                role: m.role === 'user' ? 'user' : 'model',
                parts: [{ text: m.content }],
            })
        }

        // Prepare the last user message with optional file
        const userMessage = messages[messages.length - 1]
        const contentParts: any[] = []

        // Add file if present (multimodal support)
        if (file) {
            const base64Data = file.data.split(',')[1]
            const mimeType = file.type
            contentParts.push({
                inlineData: {
                    mimeType: mimeType,
                    data: base64Data,
                },
            })
        }

        // Add text message
        contentParts.push({ text: userMessage.content })

        contents.push({ role: 'user', parts: contentParts })

        // First call with function tools
        let response = await genai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents,
            config: {
                tools: [{ functionDeclarations: functionTools.map(t => t.function_declaration) as any }],
            },
        })

        // Check if AI wants to call a function
        const candidate = response.candidates?.[0]
        const parts = candidate?.content?.parts || []
        const functionCallPart = parts.find((p: any) => p.functionCall)

        if (functionCallPart?.functionCall) {
            const name = functionCallPart.functionCall.name!
            const args = functionCallPart.functionCall.args

            // Execute the function
            const executionResult = executeFunctionCall(name, args, documentContent)

            if (!executionResult.success) {
                return NextResponse.json({
                    message: {
                        role: 'assistant',
                        content: `❌ Error: ${executionResult.error}`,
                        functionCall: { name, args },
                    },
                })
            }

            // CRITICAL: Format the NEW document state for AI
            const newDocumentWithLines = formatDocumentForAI(executionResult.newContent!)
            const newLineCount = executionResult.newContent!.split('\n').length

            // Send result back to AI with UPDATED document state
            const followUpContents = [
                ...contents,
                {
                    role: 'model',
                    parts: [{ functionCall: { name, args } }],
                },
                {
                    role: 'user',
                    parts: [
                        {
                            functionResponse: {
                                name,
                                response: {
                                    success: true,
                                    message: `Function ${name} executed successfully.`,
                                    updatedDocument: newDocumentWithLines,
                                    lineCount: newLineCount,
                                },
                            },
                        },
                    ],
                },
            ]

            response = await genai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: followUpContents,
            })

            const responseText =
                response.candidates?.[0]?.content?.parts
                    ?.map((p: any) => p.text)
                    .filter(Boolean)
                    .join('') || '✅ Document updated!'

            return NextResponse.json({
                message: {
                    role: 'assistant',
                    content: responseText,
                    functionCall: { name, args },
                },
                newDocumentContent: executionResult.newContent,
            })
        }

        // No function call, just normal chat response
        const responseText =
            parts
                .map((p: any) => p.text)
                .filter(Boolean)
                .join('') || 'I can help you edit your document. What would you like to change?'

        return NextResponse.json({
            message: {
                role: 'assistant',
                content: responseText,
            },
        })
    } catch (error: any) {
        console.error('API error:', error)
        return NextResponse.json(
            { error: 'Failed to process request', details: error.message },
            { status: 500 }
        )
    }
}
