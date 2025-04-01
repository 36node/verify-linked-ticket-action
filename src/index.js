const core = require('@actions/core');
const github = require('@actions/github');

// Configuration and environment setup
class Config {
    constructor() {
        this.context = github.context;
        this.baseUrl = process.env.BASE_URL;
        this.apiUrl = process.env.API_URL + '/api';
        this.apiKey = process.env.API_KEY || '';
        this.message = core.getInput('message') || process.env.MESSAGE || '请添加 ticket 链接!';
        this.token = process.env.GITHUB_TOKEN;
        this.octokit = github.getOctokit(this.token);

        this.validateConfig();
    }

    validateConfig() {
        if (!this.baseUrl) {
            throw new Error('BASE_URL environment variable is required');
        }
        if (!this.token) {
            throw new Error('GITHUB_TOKEN environment variable is required');
        }
    }
}

// Ticket matcher utility
class TicketMatcher {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
    }

    getRegex() {
        const escapedUrl = this.baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`${escapedUrl}\\/projects\\/(\\d+)\\/tickets\\/(\\d+)`, 'i');
    }

    extractTicketInfo(text) {
        const matches = (text || '').match(this.getRegex());

        if (!matches || matches.length < 3) {
            return null;
        }

        return {
            projectId: matches[1],
            ticketId: matches[2]
        };
    }
}

// API client for ticket verification
class TicketAPI {
    constructor(baseUrl, apiKey) {
        this.apiUrl = baseUrl;
        this.apiKey = apiKey;
    }

    async verifyTicket(projectId, ticketId) {
        try {
            const response = await fetch(`${this.apiUrl}/projects/${projectId}/tickets/${ticketId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.apiKey && { 'X-API-KEY': this.apiKey })
                },
            });

            core.debug(`Response: ${response.ok} - ${response.status}`);
            core.debug(`Response body: ${await response.text()}`);
            return { isValid: response.ok, status: response.status };
        } catch (error) {
            core.debug(`API error: ${error.message}`);
            return {
                isValid: false,
                error: error.message
            };
        }
    }
}

// GitHub PR comment handler
class GitHubCommenter {
    constructor(octokit, context) {
        this.octokit = octokit;
        this.context = context;
    }

    async addComment(message) {
        try {
            await this.octokit.rest.issues.createComment({
                issue_number: this.context.issue.number,
                owner: this.context.repo.owner,
                repo: this.context.repo.repo,
                body: message,
            });
            core.debug('Comment added successfully');
        } catch (error) {
            core.error(`Failed to add comment: ${error.message}`);
        }
    }
}

// Main action logic
class TicketVerificationAction {
    constructor() {
        this.config = new Config();
        this.matcher = new TicketMatcher(this.config.baseUrl);
        this.api = new TicketAPI(this.config.apiUrl, this.config.apiKey);
        this.commenter = new GitHubCommenter(this.config.octokit, this.config.context);
    }

    async run() {
        try {
            const prBody = this.config.context.payload.pull_request?.body || '';
            const ticketInfo = this.matcher.extractTicketInfo(prBody);

            if (!ticketInfo) {
                await this.handleMissingTicket('No ticket link found in the pull request description.');
                return;
            }

            await this.verifyTicket(ticketInfo);
        } catch (error) {
            core.setFailed(`Unhandled error: ${error.message}`);
            if (error.stack) core.debug(error.stack);
        }
    }

    async verifyTicket(ticketInfo) {
        const { projectId, ticketId } = ticketInfo;
        core.info(`Verifying ticket - Project ID: ${projectId}, Ticket ID: ${ticketId}`);

        const result = await this.api.verifyTicket(projectId, ticketId);

        if (result.isValid) {
            core.info('✅ Ticket verification successful!');
        } else {
            const errorMessage = result.error
                ? `Error verifying ticket: ${result.error}`
                : `Invalid ticket: Status ${result.status} ${result.statusText}`;

            await this.handleMissingTicket(`${errorMessage} for Project ID: ${projectId}, Ticket ID: ${ticketId}`);
        }
    }

    async handleMissingTicket(reason) {
        core.error(`❌ Ticket verification failed: ${reason}`);
        core.setFailed(reason);
        await this.commenter.addComment(this.config.message);
    }
}

// Execute the action
async function run() {
    const action = new TicketVerificationAction();
    await action.run();
}

void run();
