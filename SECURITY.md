# Security Policy

## Overview

Deep Research implements enterprise-grade security practices to protect sensitive data and prevent unauthorized access.

## Security Features

### 1. API Key Management

- **Validation**: All API keys are validated at startup
- **Masking**: API keys are masked in logs (only first/last 4 characters shown)
- **No Hardcoding**: API keys must be provided via environment variables
- **Format Checking**: API keys are validated for correct format

### 2. Input Validation and Sanitization

- **Topic Validation**: Research topics are validated before processing
- **Length Limits**: Maximum topic length enforced (default: 1000 characters)
- **Character Filtering**: Dangerous characters and control sequences removed
- **Null Byte Protection**: Null bytes stripped from input

### 3. Prompt Injection Detection

The system detects and blocks common prompt injection patterns:

- Direct instruction manipulation ("ignore previous instructions")
- System message injections
- Role manipulation attempts ("act as", "you are now")
- Jailbreak attempts
- Code execution attempts
- SQL injection patterns
- XXE injection patterns
- Path traversal attempts

**Confidence Levels:**
- **Low**: 0 patterns detected
- **Medium**: 1-2 patterns detected
- **High**: 3+ patterns detected (request blocked)

### 4. Error Sanitization

In production mode:
- Stack traces are never exposed to users
- File paths are redacted
- API keys are masked
- Email addresses are redacted
- Generic error messages replace detailed errors

### 5. Rate Limiting

- **Default Limit**: 60 requests per minute per identifier
- **Configurable**: Adjust via `RATE_LIMIT_RPM` environment variable
- **Automatic Cleanup**: Expired rate limit records automatically cleaned

### 6. Circuit Breaker Pattern

Protects against cascading failures:
- **States**: CLOSED, OPEN, HALF_OPEN
- **Failure Threshold**: 5 failures in 1 minute opens circuit
- **Reset Timeout**: 30 seconds before attempting to close
- **Success Threshold**: 2 consecutive successes to close circuit

## Configuration

### Environment Variables

```bash
# Enable security features
ENABLE_RATE_LIMIT=true
ENABLE_PROMPT_INJECTION_DETECTION=true
SANITIZE_ERRORS=true

# Rate limiting
RATE_LIMIT_RPM=60

# Input validation
MAX_TOPIC_LENGTH=1000
```

### Production Defaults

When `NODE_ENV=production`:
- Rate limiting is automatically enabled
- Error sanitization is automatically enabled
- All security features are activated

## Reporting Security Vulnerabilities

### Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

### How to Report

**DO NOT** create public GitHub issues for security vulnerabilities.

Instead:

1. Email security@yourcompany.com with details
2. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)
3. Allow up to 48 hours for initial response
4. Allow up to 30 days for patch development

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Every 7 days
- **Patch Timeline**: 30 days for critical, 60 days for medium, 90 days for low severity

## Security Best Practices

### For Developers

1. **Never commit .env files**
   ```bash
   # .env is already in .gitignore
   git add -f .env  # DON'T DO THIS
   ```

2. **Rotate API keys regularly**
   - Together.ai: Every 90 days
   - Exa Search: Every 90 days

3. **Use environment-specific configurations**
   ```bash
   # Development
   NODE_ENV=development

   # Production
   NODE_ENV=production
   ```

4. **Enable all security features in production**
   ```bash
   ENABLE_RATE_LIMIT=true
   ENABLE_PROMPT_INJECTION_DETECTION=true
   SANITIZE_ERRORS=true
   ```

5. **Monitor security metrics**
   - Rate limit violations
   - Prompt injection detections
   - Circuit breaker states

### For Operations

1. **Secrets Management**
   - Use AWS Secrets Manager / HashiCorp Vault in production
   - Never log API keys or sensitive data
   - Rotate secrets on a schedule

2. **Network Security**
   - Use HTTPS/TLS for all external communication
   - Implement API gateway rate limiting
   - Use VPC for database connections

3. **Access Control**
   - Implement least privilege access
   - Use IAM roles for service authentication
   - Enable audit logging

4. **Monitoring**
   - Monitor failed authentication attempts
   - Alert on unusual patterns
   - Track security metrics

## Security Checklist

Before deploying to production:

- [ ] All API keys configured via environment variables
- [ ] `.env` file not committed to version control
- [ ] Rate limiting enabled
- [ ] Error sanitization enabled
- [ ] Prompt injection detection enabled
- [ ] Health checks configured
- [ ] Metrics collection enabled
- [ ] Circuit breakers tested
- [ ] Security headers configured
- [ ] TLS/HTTPS enabled
- [ ] Database connections encrypted
- [ ] Secrets rotated within 90 days
- [ ] Vulnerability scan completed
- [ ] Penetration testing completed (for production)

## Compliance

### Data Protection

- **Encryption at Rest**: Recommended for production databases
- **Encryption in Transit**: TLS 1.2+ required
- **Data Retention**: Configurable (default: no data persistence)
- **Right to Erasure**: Support via database purge operations

### Standards

- **OWASP Top 10**: Addressed
- **CWE Top 25**: Addressed
- **GDPR**: Partial compliance (data minimization, encryption)
- **SOC 2**: Ready for audit (with full implementation)

## Security Features by Version

### v0.1.0

- ✅ API key validation
- ✅ Input sanitization
- ✅ Prompt injection detection
- ✅ Error sanitization
- ✅ Rate limiting
- ✅ Circuit breaker

### Planned for v0.2.0

- 🔄 API key rotation
- 🔄 Audit logging
- 🔄 Encryption at rest
- 🔄 RBAC (Role-Based Access Control)
- 🔄 IP whitelist/blacklist
- 🔄 Request signing

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE Top 25](https://cwe.mitre.org/top25/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)

---

**Last Updated**: November 8, 2025
**Next Review**: February 8, 2026
