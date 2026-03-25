#!/usr/bin/env node

/**
 * Standalone stdio MCP server for OpenCode integration.
 * Spawned by OpenCode via its MCP config. Provides the 7 assistant tools
 * (set_goal, create/update/delete assumption, create/update/delete requirement).
 *
 * Each tool accepts project_id as a required parameter since this process
 * is long-lived and shared across sessions.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import mysql from 'mysql2/promise';
import crypto from 'node:crypto';

const pool = mysql.createPool({
    host: process.env.DOLT_HOST ?? 'localhost',
    port: parseInt(process.env.DOLT_PORT ?? '3306', 10),
    user: process.env.DOLT_USER ?? 'root',
    password: process.env.DOLT_PASSWORD ?? '',
    database: process.env.DOLT_DATABASE ?? 'brunch',
    waitForConnections: true,
    connectionLimit: 5,
});

// ── Wizard streaming tools (no DB, just acks) ──
const WIZARD_TOOLS = [
    {
        name: 'add_question',
        description: 'Add a clarifying question. Call this once per question.',
        inputSchema: {
            type: 'object',
            properties: {
                id: { type: 'string' },
                question: { type: 'string' },
                why: { type: 'string' },
                impact: { type: 'string', enum: ['high', 'medium', 'low'] },
                selectionType: { type: 'string', enum: ['single', 'multi'] },
                options: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' } }, required: ['label'] } },
            },
            required: ['id', 'question', 'why', 'impact', 'selectionType', 'options'],
        },
    },
    {
        name: 'add_assumption',
        description: 'Add a project assumption. Call this once per assumption.',
        inputSchema: {
            type: 'object',
            properties: {
                id: { type: 'string' },
                label: { type: 'string' },
                text: { type: 'string' },
                rationale: { type: 'string' },
                impact: { type: 'string', enum: ['high', 'medium', 'low'] },
                confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
                options: { type: 'array', items: { type: 'string' } },
            },
            required: ['id', 'label', 'text', 'rationale', 'impact', 'confidence', 'options'],
        },
    },
    {
        name: 'add_requirement',
        description: 'Add a top-level requirement with children and checks. Call this once per requirement.',
        inputSchema: {
            type: 'object',
            properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                status: { type: 'string', enum: ['uncertain', 'decision_node', 'ok'] },
                checks: { type: 'array', items: { type: 'object', properties: { description: { type: 'string' }, type: { type: 'string', enum: ['benchmark', 'e2e', 'unit', 'human_review', 'static_analysis'] } }, required: ['description', 'type'] } },
                children: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, title: { type: 'string' }, status: { type: 'string', enum: ['uncertain', 'decision_node', 'ok'] }, checks: { type: 'array', items: { type: 'object', properties: { description: { type: 'string' }, type: { type: 'string', enum: ['benchmark', 'e2e', 'unit', 'human_review', 'static_analysis'] } }, required: ['description', 'type'] } }, children: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, title: { type: 'string' }, checks: { type: 'array', items: { type: 'object', properties: { description: { type: 'string' }, type: { type: 'string', enum: ['benchmark', 'e2e', 'unit', 'human_review', 'static_analysis'] } }, required: ['description', 'type'] } } }, required: ['id', 'title', 'checks'] } } }, required: ['id', 'title', 'checks'] } },
            },
            required: ['id', 'title', 'checks', 'children'],
        },
    },
    {
        name: 'set_requirements_meta',
        description: 'Set the project title and description. Call this exactly once before adding requirements.',
        inputSchema: {
            type: 'object',
            properties: {
                title: { type: 'string' },
                description: { type: 'string' },
            },
            required: ['title', 'description'],
        },
    },
];

const TOOLS = [
    {
        name: 'set_goal',
        description: 'Set the goal text in the spec elicitation form. Use this when the user has agreed on a goal definition.',
        inputSchema: {
            type: 'object',
            properties: {
                project_id: { type: 'string', description: 'The project ID' },
                goal: { type: 'string', description: 'The goal text to set in the form' },
            },
            required: ['project_id', 'goal'],
        },
    },
    {
        name: 'update_assumption',
        description: 'Update an assumption in the spec.',
        inputSchema: {
            type: 'object',
            properties: {
                project_id: { type: 'string', description: 'The project ID' },
                id: { type: 'string', description: 'The assumption ID to update' },
                text: { type: 'string', description: 'New text for the assumption' },
                status: { type: 'string', enum: ['pending', 'confirmed', 'edited', 'rejected'], description: 'New status' },
                confidence: { type: 'string', enum: ['high', 'medium', 'low'], description: 'New confidence level' },
                impact: { type: 'string', enum: ['high', 'medium', 'low'], description: 'New impact level' },
            },
            required: ['project_id', 'id'],
        },
    },
    {
        name: 'create_assumption',
        description: 'Create a new assumption in the spec.',
        inputSchema: {
            type: 'object',
            properties: {
                project_id: { type: 'string', description: 'The project ID' },
                text: { type: 'string', description: 'The assumption text' },
                rationale: { type: 'string', description: 'Why this assumption is being made' },
                confidence: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Confidence level' },
                impact: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Impact level' },
            },
            required: ['project_id', 'text', 'rationale', 'confidence', 'impact'],
        },
    },
    {
        name: 'delete_assumption',
        description: 'Delete an assumption from the spec.',
        inputSchema: {
            type: 'object',
            properties: {
                project_id: { type: 'string', description: 'The project ID' },
                id: { type: 'string', description: 'The assumption ID to delete' },
            },
            required: ['project_id', 'id'],
        },
    },
    {
        name: 'update_requirement',
        description: 'Update a requirement in the spec.',
        inputSchema: {
            type: 'object',
            properties: {
                project_id: { type: 'string', description: 'The project ID' },
                id: { type: 'string', description: 'The requirement ID to update' },
                title: { type: 'string', description: 'New title' },
                definition: { type: 'string', description: 'New definition' },
                confidence: { type: 'number', description: 'New confidence level (0-1)' },
                stage: { type: 'string', enum: ['proposal', 'approved', 'completed'], description: 'New stage' },
            },
            required: ['project_id', 'id'],
        },
    },
    {
        name: 'create_requirement',
        description: 'Create a new requirement in the spec.',
        inputSchema: {
            type: 'object',
            properties: {
                project_id: { type: 'string', description: 'The project ID' },
                title: { type: 'string', description: 'The requirement title' },
                definition: { type: 'string', description: 'The requirement definition/description' },
                confidence: { type: 'number', description: 'Confidence level (0-1), defaults to 0.5' },
                parent_id: { type: 'string', description: 'Parent requirement ID for nesting' },
            },
            required: ['project_id', 'title', 'definition'],
        },
    },
    {
        name: 'delete_requirement',
        description: 'Delete a requirement from the spec.',
        inputSchema: {
            type: 'object',
            properties: {
                project_id: { type: 'string', description: 'The project ID' },
                id: { type: 'string', description: 'The requirement ID to delete' },
            },
            required: ['project_id', 'id'],
        },
    },
];

const server = new Server(
    { name: 'brunch-assistant', version: '1.0.0' },
    { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [...TOOLS, ...WIZARD_TOOLS] }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const projectId = args.project_id;

    try {
        switch (name) {
            case 'set_goal': {
                await pool.execute('UPDATE project SET goal = ?, updated_at = NOW() WHERE pk = ?', [args.goal, projectId]);
                return { content: [{ type: 'text', text: 'Goal has been set successfully in the form.' }] };
            }
            case 'update_assumption': {
                const sets = [];
                const params = [];
                if (args.text != null) { sets.push('`text` = ?', '`edited_text` = ?'); params.push(args.text, args.text); }
                if (args.status != null) { sets.push('`status` = ?'); params.push(args.status); }
                if (args.confidence != null) { sets.push('`confidence` = ?'); params.push(args.confidence); }
                if (args.impact != null) { sets.push('`impact` = ?'); params.push(args.impact); }
                if (sets.length > 0) {
                    sets.push('`updated_at` = NOW()');
                    params.push(args.id, projectId);
                    await pool.execute(`UPDATE assumption SET ${sets.join(', ')} WHERE uuid = ? AND project_id = ?`, params);
                }
                return { content: [{ type: 'text', text: `Assumption ${args.id} has been updated successfully.` }] };
            }
            case 'create_assumption': {
                const uuid = crypto.randomUUID();
                const [maxRows] = await pool.execute('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM assumption WHERE project_id = ?', [projectId]);
                const sortOrder = maxRows[0].next_order;
                await pool.execute(
                    'INSERT INTO assumption (uuid, project_id, `text`, rationale, confidence, impact, status, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [uuid, projectId, args.text, args.rationale, args.confidence, args.impact, 'pending', sortOrder],
                );
                return { content: [{ type: 'text', text: `Assumption created with id ${uuid}.` }] };
            }
            case 'delete_assumption': {
                await pool.execute('DELETE FROM assumption WHERE uuid = ? AND project_id = ?', [args.id, projectId]);
                return { content: [{ type: 'text', text: `Assumption ${args.id} has been deleted.` }] };
            }
            case 'update_requirement': {
                const sets = [];
                const params = [];
                if (args.title != null) { sets.push('`title` = ?'); params.push(args.title); }
                if (args.definition != null) { sets.push('`description` = ?'); params.push(args.definition); }
                if (args.confidence != null) { sets.push('`confidence` = ?'); params.push(args.confidence); }
                if (args.stage != null) { sets.push('`stage` = ?'); params.push(args.stage); }
                if (sets.length > 0) {
                    sets.push('`updated_at` = NOW()');
                    params.push(args.id, projectId);
                    await pool.execute(`UPDATE entry SET ${sets.join(', ')} WHERE uuid = ? AND project_id = ?`, params);
                }
                return { content: [{ type: 'text', text: `Requirement ${args.id} has been updated successfully.` }] };
            }
            case 'create_requirement': {
                const uuid = crypto.randomUUID();
                let parentPk = null;
                if (args.parent_id) {
                    const [parentRows] = await pool.execute('SELECT pk FROM entry WHERE uuid = ? AND project_id = ?', [args.parent_id, projectId]);
                    if (parentRows.length > 0) parentPk = parentRows[0].pk;
                }
                const [maxRows] = await pool.execute('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM entry WHERE project_id = ?', [projectId]);
                const sortOrder = maxRows[0].next_order;
                await pool.execute(
                    'INSERT INTO entry (uuid, project_id, title, `description`, confidence, stage, parent_id, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [uuid, projectId, args.title, args.definition, args.confidence ?? 0.5, 'proposal', parentPk, sortOrder],
                );
                return { content: [{ type: 'text', text: `Requirement created with id ${uuid}.` }] };
            }
            case 'delete_requirement': {
                await pool.execute('DELETE FROM entry WHERE uuid = ? AND project_id = ?', [args.id, projectId]);
                return { content: [{ type: 'text', text: `Requirement ${args.id} has been deleted.` }] };
            }
            // Wizard streaming tools — just ack
            case 'add_question':
            case 'add_assumption':
            case 'add_requirement':
            case 'set_requirements_meta':
                return { content: [{ type: 'text', text: `OK: ${name}` }] };
            default:
                return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
        }
    } catch (e) {
        return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true };
    }
});

const transport = new StdioServerTransport();
await server.connect(transport);
