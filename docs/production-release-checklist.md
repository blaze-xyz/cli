# Blaze CLI Production Release Checklist

This document provides a comprehensive checklist for safely releasing the Blaze CLI to production/public use.

## Overview

The Blaze CLI is a command-line interface and MCP server that provides programmatic access to the Blaze platform for developers and AI agents. Before public release, we must ensure reliability, security, and excellent developer experience.

---

## Phase 1: Testing & Quality Assurance

### Unit Tests
- [ ] **All SDK methods have unit tests**
  - [ ] Authentication flows (API key validation)
  - [ ] Request builders (query params, headers, body)
  - [ ] Response parsers (JSON parsing, error extraction)
  - [ ] Type guards and validators
  - [ ] Error handling for each client method
  - [ ] Target: >85% code coverage on SDK client

- [ ] **CLI command tests**
  - [ ] Argument parsing (required/optional, defaults)
  - [ ] Flag validation (--format, --limit, --offset, etc.)
  - [ ] Output formatters (JSON, table, CSV)
  - [ ] Help text generation
  - [ ] Version command
  - [ ] Target: >80% coverage on CLI layer

- [ ] **MCP tool tests**
  - [ ] Schema validation for each tool
  - [ ] Argument mapping from MCP format to SDK calls
  - [ ] Response transformation
  - [ ] Error handling and user-friendly messages
  - [ ] Target: >85% coverage on MCP layer

### Integration Tests
- [ ] **E2E test suite created** (`test-cli-e2e.sh`)
  - [ ] Tests run against staging environment
  - [ ] All commands tested with real API calls
  - [ ] Error scenarios validated (auth failures, invalid params)
  - [ ] Output format validation (JSON, table, CSV)
  - [ ] Pagination tested

- [ ] **MCP server integration tests**
  - [ ] Server starts successfully
  - [ ] All tools are registered correctly
  - [ ] Tools can be invoked via MCP protocol
  - [ ] Error responses are properly formatted

- [ ] **CI/CD integration**
  - [ ] E2E tests run on every PR
  - [ ] Tests run against staging before merge
  - [ ] Integration with GitHub Actions workflow

### Manual QA
- [ ] **Smoke test all commands manually**
  - [ ] Test on macOS
  - [ ] Test on Linux
  - [ ] Test on Windows (if Windows support planned)

- [ ] **Test with real user workflows**
  - [ ] Check balance and user info
  - [ ] List and filter transactions
  - [ ] View recipients
  - [ ] Get FX rates and convert amounts
  - [ ] View analytics
  - [ ] Manage webhooks
  - [ ] Test all output formats

- [ ] **MCP server smoke test**
  - [ ] Start MCP server
  - [ ] Connect with Claude Desktop or other MCP client
  - [ ] Invoke each tool through the MCP interface
  - [ ] Verify responses are user-friendly

---

## Phase 2: Security & Authentication

### API Key Management
- [ ] **Secure storage implementation**
  - [ ] API keys stored in OS keychain (macOS/Linux/Windows)
  - [ ] Fallback to encrypted file if keychain unavailable
  - [ ] Never store keys in plaintext config files
  - [ ] Clear documentation on key storage location

- [ ] **Key rotation support**
  - [ ] Users can update their API key easily
  - [ ] Old keys are securely removed
  - [ ] No keys left in shell history

- [ ] **Security audit**
  - [ ] No secrets in code or logs
  - [ ] Sensitive data redacted from error messages
  - [ ] No API keys in URLs or query params
  - [ ] HTTPS enforced for all API calls

### Rate Limiting & Abuse Prevention
- [ ] **Rate limit handling**
  - [ ] Detect 429 responses from API
  - [ ] Exponential backoff with jitter
  - [ ] User-friendly rate limit messages
  - [ ] Optional `--retry` flag for automatic retries

- [ ] **Request throttling**
  - [ ] Bulk operations respect API limits
  - [ ] Progress indicators for long operations
  - [ ] Ability to cancel long-running commands

### Permissions & Scopes
- [ ] **API key permissions documented**
  - [ ] Clear docs on what each command requires
  - [ ] Graceful handling of insufficient permissions
  - [ ] Helpful error messages suggesting correct scopes

---

## Phase 3: Documentation & Developer Experience

### Installation Documentation
- [ ] **README.md complete**
  - [ ] Installation instructions (npm, yarn, pnpm)
  - [ ] System requirements clearly stated
  - [ ] Quick start guide (5 minutes to first command)
  - [ ] Troubleshooting section

- [ ] **Package metadata**
  - [ ] `package.json` has all required fields
  - [ ] Keywords for discoverability
  - [ ] License properly specified
  - [ ] Repository URL correct
  - [ ] Homepage and bug tracker links

### Usage Documentation
- [ ] **CLI documentation** (`docs/cli.md`)
  - [ ] Every command documented with examples
  - [ ] All flags and options explained
  - [ ] Common use cases covered
  - [ ] Output format examples shown

- [ ] **SDK documentation** (`docs/sdk.md`)
  - [ ] All methods documented with TypeScript signatures
  - [ ] Usage examples for each method
  - [ ] Error handling patterns explained
  - [ ] Authentication setup guide

- [ ] **MCP documentation** (`docs/mcp.md`)
  - [ ] MCP server setup instructions
  - [ ] Tool catalog with descriptions
  - [ ] Example prompts for AI agents
  - [ ] Debugging tips for MCP issues

### Help Text & Error Messages
- [ ] **Command help is comprehensive**
  - [ ] `--help` on every command
  - [ ] Clear descriptions
  - [ ] Example usage included
  - [ ] Related commands suggested

- [ ] **Error messages are actionable**
  - [ ] Tell users what went wrong
  - [ ] Suggest how to fix it
  - [ ] Link to docs when relevant
  - [ ] Include error codes for debugging

---

## Phase 4: Performance & Reliability

### Performance Benchmarks
- [ ] **Response time targets**
  - [ ] Simple queries (user:me) < 500ms
  - [ ] List operations < 1s for 100 items
  - [ ] Bulk operations show progress
  - [ ] No memory leaks in long-running processes

- [ ] **Resource usage**
  - [ ] CLI binary size reasonable (<50MB)
  - [ ] Memory usage acceptable (<100MB for typical use)
  - [ ] No excessive CPU usage
  - [ ] MCP server is lightweight

### Error Recovery
- [ ] **Network resilience**
  - [ ] Retry on transient failures (5xx, timeouts)
  - [ ] Clear messages on network errors
  - [ ] Graceful degradation when API unavailable

- [ ] **Data validation**
  - [ ] Input validation before API calls
  - [ ] Response schema validation
  - [ ] Helpful errors for invalid data

### Monitoring & Observability
- [ ] **Error tracking setup**
  - [ ] Integrate with Sentry or similar
  - [ ] User opt-in for telemetry
  - [ ] Privacy-respecting error reports

- [ ] **Usage analytics** (optional)
  - [ ] Track command usage (opt-in)
  - [ ] Identify popular features
  - [ ] Detect breaking changes early

---

## Phase 5: Distribution & Release

### Package Publishing
- [ ] **NPM package ready**
  - [ ] Package name available (`@blaze-money/cli` or `blaze-cli`)
  - [ ] Version follows semver (start with 1.0.0)
  - [ ] All dependencies specified correctly
  - [ ] Dev dependencies separated
  - [ ] Peer dependencies declared if needed

- [ ] **Build artifacts**
  - [ ] TypeScript compiled to JavaScript
  - [ ] Type definitions included (`.d.ts` files)
  - [ ] Source maps available for debugging
  - [ ] Binary executables for each platform (optional)

- [ ] **NPM publish workflow**
  - [ ] Automated via GitHub Actions
  - [ ] Publish on tag push (v1.0.0, v1.0.1, etc.)
  - [ ] Changelog automatically generated
  - [ ] Release notes posted to GitHub

### Version Management
- [ ] **Changelog maintained**
  - [ ] Follow Keep a Changelog format
  - [ ] All breaking changes highlighted
  - [ ] Migration guides for major versions

- [ ] **Deprecation policy**
  - [ ] How deprecated features are communicated
  - [ ] Timeline for removal (e.g., 6 months notice)
  - [ ] Version support policy documented

### Distribution Channels
- [ ] **NPM registry**
  - [ ] Published to public NPM
  - [ ] Package page looks good
  - [ ] README renders correctly

- [ ] **Homebrew (optional)**
  - [ ] Formula created for macOS users
  - [ ] Auto-update support

- [ ] **GitHub Releases**
  - [ ] Release assets uploaded
  - [ ] Release notes published
  - [ ] Pre-release tags for beta versions

---

## Phase 6: Support & Maintenance

### User Support
- [ ] **Support channels established**
  - [ ] GitHub Issues for bug reports
  - [ ] Discussions for questions
  - [ ] Email support for enterprise users
  - [ ] Response time SLA defined

- [ ] **Issue templates**
  - [ ] Bug report template
  - [ ] Feature request template
  - [ ] Question/discussion template

### Community
- [ ] **Contributing guide**
  - [ ] How to report bugs
  - [ ] How to submit PRs
  - [ ] Code of conduct
  - [ ] Development setup instructions

- [ ] **Examples & tutorials**
  - [ ] Example scripts in `examples/` directory
  - [ ] Tutorial for common workflows
  - [ ] Integration guides (CI/CD, automation, etc.)

### Maintenance Plan
- [ ] **Update schedule**
  - [ ] Patch releases for bugs (as needed)
  - [ ] Minor releases for features (monthly?)
  - [ ] Major releases for breaking changes (yearly?)

- [ ] **Dependency updates**
  - [ ] Automated dependency updates (Dependabot)
  - [ ] Security vulnerability monitoring
  - [ ] Regular dependency audits

---

## Phase 7: Compliance & Legal

### Licensing
- [ ] **License chosen and applied**
  - [ ] LICENSE file in repo
  - [ ] License badge in README
  - [ ] License compatible with dependencies

### Privacy & Data Protection
- [ ] **Privacy policy**
  - [ ] Data collection practices disclosed
  - [ ] GDPR compliance if applicable
  - [ ] User consent for analytics/telemetry

- [ ] **Terms of service**
  - [ ] CLI usage terms clear
  - [ ] Rate limits and fair use policy
  - [ ] API abuse consequences defined

### Third-Party Compliance
- [ ] **Attribution**
  - [ ] All OSS dependencies properly credited
  - [ ] NOTICE file if required
  - [ ] Licenses checked for compatibility

---

## Phase 8: Marketing & Launch

### Announcement
- [ ] **Launch blog post**
  - [ ] Introduction to CLI
  - [ ] Key features highlighted
  - [ ] Getting started guide
  - [ ] Example use cases

- [ ] **Social media**
  - [ ] Twitter/X announcement
  - [ ] LinkedIn post
  - [ ] Reddit (r/programming, etc.)
  - [ ] Hacker News (Show HN)

### Developer Outreach
- [ ] **Integrations showcase**
  - [ ] Example GitHub Actions workflow
  - [ ] Example automation scripts
  - [ ] AI agent integration (Claude, ChatGPT)

- [ ] **Video demo**
  - [ ] Screen recording of basic usage
  - [ ] Advanced workflow examples
  - [ ] Publish to YouTube

### SEO & Discoverability
- [ ] **Website page**
  - [ ] Landing page for CLI at blaze.money/cli
  - [ ] Install instructions prominent
  - [ ] Feature comparison with web dashboard

- [ ] **Documentation site**
  - [ ] Searchable docs (Algolia)
  - [ ] API reference generated from code
  - [ ] Version switcher for docs

---

## Pre-Launch Final Checks

### Critical Checklist (Must Pass Before Launch)
- [ ] **All tests passing**
  - [ ] Unit tests: 100% pass rate
  - [ ] Integration tests: 100% pass rate
  - [ ] E2E tests: 100% pass rate

- [ ] **Security audit completed**
  - [ ] No secrets in code
  - [ ] API keys secured properly
  - [ ] Rate limiting works

- [ ] **Documentation reviewed**
  - [ ] No broken links
  - [ ] All commands documented
  - [ ] Examples tested and working

- [ ] **Staging deployment successful**
  - [ ] CLI works against staging API
  - [ ] MCP server works in staging
  - [ ] No critical bugs found

- [ ] **Production smoke test**
  - [ ] Test with production API (limited scope)
  - [ ] Verify authentication works
  - [ ] Confirm rate limits are correct

### Launch Approval
- [ ] **Stakeholder sign-off**
  - [ ] Engineering lead approval
  - [ ] Product manager approval
  - [ ] Security team approval (if applicable)

- [ ] **Rollback plan**
  - [ ] How to unpublish from NPM (if needed)
  - [ ] Communication plan for issues
  - [ ] Hotfix process defined

---

## Post-Launch Monitoring (First 7 Days)

### Day 1
- [ ] Monitor NPM downloads
- [ ] Check GitHub issues for immediate bugs
- [ ] Monitor error tracking (Sentry)
- [ ] Respond to community feedback

### Week 1
- [ ] Review usage analytics
- [ ] Identify most popular commands
- [ ] Collect feedback from early adopters
- [ ] Plan first patch release if needed

---

## Version History

| Version | Date       | Changes |
|---------|------------|---------|
| 1.0.0   | TBD        | Initial checklist created |

---

## Additional Resources

- **E2E Test Script**: `test-cli-e2e.sh`
- **CLI Documentation**: `docs/cli.md`
- **SDK Documentation**: `docs/sdk.md`
- **MCP Documentation**: `docs/mcp.md`
- **API Reference**: https://api.blaze.money/docs
- **GitHub Repository**: https://github.com/blaze-xyz/blaze-cli

---

## Notes

**Security Priority**: API key management and secure storage are critical. Do not launch without proper keychain integration.

**Testing Priority**: E2E tests must pass 100% before launch. Integration tests catch real-world issues that unit tests miss.

**Documentation Priority**: Excellent documentation drives adoption. Invest time here.

**Performance**: CLI must feel instant for common operations. Target <500ms for simple queries.

**Backwards Compatibility**: After 1.0.0, follow semver strictly. Breaking changes only in major versions.
