# Together Deep Research - Enterprise Edition

<div align="center">

[![CI/CD](https://github.com/djimit/deep-research/actions/workflows/ci.yml/badge.svg)](https://github.com/djimit/deep-research/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)

**Enterprise-grade AI research platform delivering comprehensive, well-cited reports with production-ready reliability and security.**

</div>

---

## 🌟 Overview

Together Deep Research is an enterprise-ready TypeScript implementation that delivers in-depth research on complex topics requiring multi-hop reasoning. It enhances traditional web search by producing comprehensive, well-cited content that mimics the human research process - planning, searching, evaluating information, and iterating until completion.

Based on the Python implementation [open_deep_research](https://github.com/togethercomputer/open_deep_research) from Together AI, this version adds **enterprise-grade features** for production deployment.

---

## ✨ Features

### Core Research Capabilities
- ✅ **Comprehensive Research Reports** - Generates long-form, well-cited content on complex topics
- ✅ **Multi-Stage Process** - Uses multiple self-reflection stages for quality information gathering
- ✅ **Model Flexibility** - Supports multiple LLM models for different research stages
- ✅ **Extensible Architecture** - Built with TypeScript for type safety and better developer experience

### Enterprise Features ⭐ NEW
- 🔒 **Security**: Prompt injection detection, input sanitization, rate limiting
- 📊 **Observability**: Prometheus metrics, health checks, distributed tracing support
- 🔄 **Resilience**: Circuit breakers, retry logic with exponential backoff
- ⚙️ **Configuration**: Environment-based config with validation
- 💰 **Cost Tracking**: Built-in cost estimation and budget management
- 🐳 **Docker Ready**: Multi-stage Docker builds with docker-compose
- 🚀 **CI/CD**: GitHub Actions pipeline with security scanning
- 📝 **Audit Logging**: Track all research operations (coming soon)

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20+ and pnpm
- Together.ai API key ([Get one here](https://api.together.xyz/))
- Exa Search API key ([Get one here](https://exa.ai/))

### Installation

```bash
# Clone the repository
git clone https://github.com/djimit/deep-research.git
cd deep-research

# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env

# Edit .env and add your API keys
# TOGETHER_API_KEY=your_key_here
# EXA_API_KEY=your_key_here
```

### Basic Usage

```typescript
import { DeepResearchPipeline } from "./deepresearch/research-pipeline";

(async () => {
  const pipeline = new DeepResearchPipeline();
  const topic = "Explain quantum computing and its practical applications";
  const answer = await pipeline.runResearch(topic);
  console.log(answer);
})();
```

### Running with Docker

```bash
# Build and run with docker-compose
docker-compose up -d

# View logs
docker-compose logs -f deep-research

# Stop services
docker-compose down
```

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [Enterprise Readiness Gap Analysis](ENTERPRISE_READINESS_GAP_ANALYSIS.md) | Comprehensive analysis of all enterprise features |
| [Executive Summary](EXECUTIVE_SUMMARY.md) | High-level overview for stakeholders |
| [Action Items](ACTION_ITEMS.md) | Implementation roadmap and checklist |
| [Security Policy](SECURITY.md) | Security features and vulnerability reporting |
| [Improvements](IMPROVEMENTS.md) | Recent code quality improvements |

---

## ⚙️ Configuration

### Environment Variables

See [.env.example](.env.example) for all available configuration options.

**Required:**
```bash
TOGETHER_API_KEY=your_together_api_key
EXA_API_KEY=your_exa_api_key
```

**Optional (with defaults):**
```bash
NODE_ENV=development                    # development | staging | production | test
LOG_LEVEL=info                          # debug | info | success | warn | error
MAX_QUERIES=2                           # Maximum search queries per cycle
MAX_SOURCES=5                           # Maximum sources in final report
ENABLE_METRICS=true                     # Enable Prometheus metrics
ENABLE_RATE_LIMIT=true                  # Enable rate limiting
RATE_LIMIT_RPM=60                       # Requests per minute limit
```

### Environment-Specific Configurations

**Development:**
```bash
NODE_ENV=development
LOG_LEVEL=debug
SANITIZE_ERRORS=false
```

**Production:**
```bash
NODE_ENV=production
LOG_LEVEL=warn
SANITIZE_ERRORS=true
ENABLE_METRICS=true
ENABLE_RATE_LIMIT=true
```

---

## 🔒 Security

This project implements multiple layers of security:

- **API Key Validation**: Keys validated on startup
- **Prompt Injection Detection**: Blocks malicious input patterns
- **Input Sanitization**: Removes dangerous characters and scripts
- **Rate Limiting**: Prevents abuse (60 req/min default)
- **Error Sanitization**: No sensitive data in production errors
- **Circuit Breakers**: Prevents cascading failures

See [SECURITY.md](SECURITY.md) for full details.

---

## 📊 Monitoring & Observability

### Health Checks

```bash
# Liveness probe (is the app alive?)
GET /health/live

# Readiness probe (can accept traffic?)
GET /health/ready

# Detailed health check
GET /health
```

### Metrics (Prometheus Format)

When `ENABLE_METRICS=true`:

```bash
# Metrics endpoint
GET /metrics
```

**Available Metrics:**
- `research_requests_total` - Total research requests
- `research_duration_seconds` - Request duration histogram
- `api_calls_total` - External API calls
- `cache_hits_total` / `cache_misses_total` - Cache performance
- `rate_limit_exceeded_total` - Rate limit violations
- `prompt_injection_detected_total` - Security events

### Cost Tracking

```typescript
import { CostTracker } from "./deepresearch/metrics";

const tracker = new CostTracker();
tracker.recordCost(0.05, "search-query");
console.log(`Total cost: $${tracker.getTotalCost()}`);
```

---

## 🏗️ Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Deep Research Pipeline                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Security   │───▶│    Config    │───▶│   Metrics    │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                    │                    │          │
│         ▼                    ▼                    ▼          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            Research Pipeline Core                     │  │
│  │  (Query Gen → Search → Summarize → Filter → Report)  │  │
│  └──────────────────────────────────────────────────────┘  │
│         │                    │                    │          │
│         ▼                    ▼                    ▼          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  Together.ai │    │  Exa Search  │    │    Logger    │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                    │                    │          │
│         ▼                    ▼                    ▼          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │          Circuit Breakers & Retry Logic             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Pipeline Stages

1. **Query Generation**: LLM generates strategic search queries
2. **Web Search**: Parallel search execution via Exa API
3. **Content Summarization**: Summarize each search result
4. **Evaluation**: Assess if more research is needed
5. **Iteration**: Repeat search with new queries (up to budget)
6. **Filtering**: Select most relevant sources
7. **Synthesis**: Generate final markdown report with citations

---

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run tests in watch mode
pnpm test:watch
```

**Test Coverage:**
- Data models (SearchResult, SearchResults)
- Logger utility
- Configuration validation
- Security utilities
- Circuit breakers
- Rate limiting

---

## 🚢 Deployment

### Docker Deployment

```bash
# Build image
docker build -t deep-research:latest .

# Run container
docker run -d \
  -p 3000:3000 \
  -e TOGETHER_API_KEY=your_key \
  -e EXA_API_KEY=your_key \
  -e NODE_ENV=production \
  deep-research:latest
```

### Docker Compose (Recommended)

```bash
# Start all services (app + Redis + PostgreSQL + Prometheus + Grafana)
docker-compose up -d

# View logs
docker-compose logs -f

# Access services
# - App: http://localhost:3000
# - Grafana: http://localhost:3001 (admin/admin)
# - Prometheus: http://localhost:9091
# - Jaeger: http://localhost:16686
```

### Kubernetes (Coming Soon)

See `k8s/` directory for Kubernetes manifests.

---

## 📈 Performance

- **Request Timeout**: 5 minutes (configurable)
- **Concurrent Requests**: Up to 10 (configurable)
- **Retry Logic**: 3 attempts with exponential backoff
- **Circuit Breaker**: 5 failures triggers 30s cooldown
- **Rate Limiting**: 60 requests/minute/IP (configurable)

---

## 💰 Cost Management

### Cost Estimation

Each research request typically costs:
- Search API calls: ~$0.001 - $0.01
- LLM inference: ~$0.02 - $0.10
- **Total**: ~$0.03 - $0.15 per request

### Budget Controls

```bash
# Set maximum cost per request
MAX_COST_PER_REQUEST=1.00

# Enable cost tracking
ENABLE_COST_TRACKING=true

# Alert threshold (percentage)
COST_ALERT_THRESHOLD=80
```

---

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) first.

### Development Setup

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm run dev

# Run tests
pnpm test

# Check TypeScript
npx tsc --noEmit
```

---

## 📊 Enterprise Readiness Score

| Category | Score | Status |
|----------|-------|--------|
| Security | 8/10 | ✅ Production Ready |
| Scalability | 6/10 | ⚠️ Single Instance |
| Monitoring | 8/10 | ✅ Production Ready |
| Documentation | 9/10 | ✅ Comprehensive |
| Deployment | 8/10 | ✅ Docker Ready |
| Testing | 7/10 | ✅ Good Coverage |
| **Overall** | **7.7/10** | **✅ Enterprise Ready** |

See [Enterprise Readiness Analysis](ENTERPRISE_READINESS_GAP_ANALYSIS.md) for details.

---

## ⚠️ Disclaimer

As an LLM-based system, this tool may occasionally:

- Generate hallucinations or fabricate information that appears plausible
- Contain biases present in its training data
- Misinterpret complex queries or provide incomplete analyses
- Present outdated information

**Always verify important information from generated reports with primary sources.**

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🙏 Credits

- Python version: [Together Open Deep Research](https://github.com/togethercomputer/open_deep_research)
- LLM inference: [Together.ai](https://togetherai.link/)
- Web search: [Exa](https://exa.ai)
- Enterprise features: Built with ❤️ by the community

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/djimit/deep-research/issues)
- **Security**: See [SECURITY.md](SECURITY.md)
- **Discussions**: [GitHub Discussions](https://github.com/djimit/deep-research/discussions)

---

<div align="center">

**Made with ❤️ using TypeScript and AI**

[Documentation](ENTERPRISE_READINESS_GAP_ANALYSIS.md) • [Security](SECURITY.md) • [Contributing](CONTRIBUTING.md)

</div>
