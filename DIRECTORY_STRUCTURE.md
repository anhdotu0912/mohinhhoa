# Cấu trúc thư mục dự án

```text
P-014
├── .agents
│   ├── rules
│   │   └── ai-log-hook.md
│   └── workflows
│       └── log.md
├── .github
│   ├── hooks
│   │   └── hooks.json
│   └── workflows
│       └── ci.yml
├── backend
│   ├── app
│   │   ├── agents
│   │   │   ├── nodes
│   │   │   │   ├── intent_classifier.py
│   │   │   │   ├── profile_loader.py
│   │   │   │   └── rag_tool.py
│   │   │   ├── food_log_agent.py
│   │   │   ├── graph.py
│   │   │   ├── interaction_checker_agent.py
│   │   │   └── meal_planner_agent.py
│   │   ├── api
│   │   │   └── v1
│   │   │       ├── routes_chat.py
│   │   │       ├── routes_dietitian.py
│   │   │       ├── routes_food_log.py
│   │   │       ├── routes_meal_plan.py
│   │   │       └── routes_profile.py
│   │   ├── core
│   │   │   ├── config.py
│   │   │   └── security.py
│   │   ├── db
│   │   │   ├── init_db.py
│   │   │   └── session.py
│   │   ├── guardrails
│   │   │   ├── rules.py
│   │   │   └── source_check.py
│   │   ├── models
│   │   │   ├── alert.py
│   │   │   ├── food_log.py
│   │   │   ├── meal_plan.py
│   │   │   ├── profile.py
│   │   │   └── user.py
│   │   ├── rag
│   │   │   ├── embeddings.py
│   │   │   ├── indexer.py
│   │   │   └── retriever.py
│   │   ├── schemas
│   │   │   ├── food_log.py
│   │   │   ├── meal_plan.py
│   │   │   └── profile.py
│   │   ├── services
│   │   │   ├── notification.py
│   │   │   └── nutrition_calculator.py
│   │   └── main.py
│   ├── data
│   │   ├── guidelines
│   │   ├── drug_food_interactions.json
│   │   └── food_db_vn.json
│   ├── tests
│   │   ├── test_api.py
│   │   ├── test_interaction_checker.py
│   │   ├── test_meal_planner.py
│   │   └── test_rag.py
│   ├── .env.example
│   ├── Dockerfile
│   ├── app.db
│   └── requirements.txt
├── contracts
│   └── agent-io-schema.md
├── docs
│   ├── guide
│   │   ├── anti-patterns
│   │   │   ├── _index.md
│   │   │   └── cohort-1-mistakes.md
│   │   ├── architecture
│   │   │   ├── _index.md
│   │   │   └── system-design.md
│   │   ├── bmad
│   │   │   ├── _index.md
│   │   │   └── overview.md
│   │   ├── book-media
│   │   │   └── free-accounts
│   │   │       ├── cohere.jpg
│   │   │       ├── gemini.jpg
│   │   │       ├── groq.jpg
│   │   │       ├── huggingface.jpg
│   │   │       ├── langsmith.jpg
│   │   │       ├── mistral.jpg
│   │   │       ├── render.jpg
│   │   │       └── vercel.jpg
│   │   ├── code-style
│   │   │   ├── _index.md
│   │   │   └── python.md
│   │   ├── deliverables
│   │   │   ├── _index.md
│   │   │   └── checklist.md
│   │   ├── devops
│   │   │   ├── _index.md
│   │   │   └── docker-cicd.md
│   │   ├── langgraph
│   │   │   ├── _index.md
│   │   │   ├── nodes-and-edges.md
│   │   │   ├── state.md
│   │   │   └── tools.md
│   │   ├── patterns
│   │   │   ├── _index.md
│   │   │   └── rag-pattern.md
│   │   ├── resources
│   │   │   ├── _index.md
│   │   │   ├── recommended-courses.md
│   │   │   └── reference-teams.md
│   │   ├── setup
│   │   │   ├── _index.md
│   │   │   └── quick-start.md
│   │   ├── testing
│   │   │   ├── _index.md
│   │   │   └── writing-tests.md
│   │   ├── chapter-01.md
│   │   ├── chapter-02.md
│   │   ├── chapter-03.md
│   │   ├── chapter-04.md
│   │   ├── chapter-05.md
│   │   ├── chapter-06.md
│   │   ├── chapter-07.md
│   │   ├── chapter-08.md
│   │   ├── chapter-09.md
│   │   ├── chapter-10.md
│   │   ├── cost-management.md
│   │   ├── free-accounts.md
│   │   └── troubleshooting.md
│   └── architecture_diagram.md
├── eval
│   └── results
│       └── report.md
├── frontend
│   ├── app
│   │   ├── dashboard
│   │   │   └── page.tsx
│   │   ├── dietitian
│   │   │   └── page.tsx
│   │   ├── food-log
│   │   │   └── page.tsx
│   │   ├── meal-plan
│   │   │   └── page.tsx
│   │   ├── onboarding
│   │   │   └── page.tsx
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components
│   │   ├── alerts
│   │   ├── chat
│   │   ├── food-log
│   │   ├── meal-plan
│   │   └── ui
│   ├── lib
│   │   ├── api.ts
│   │   └── types.ts
│   ├── store
│   │   ├── useMealPlanStore.ts
│   │   └── useProfileStore.ts
│   ├── .env.local.example
│   ├── next-env.d.ts
│   ├── package-lock.json
│   ├── package.json
│   └── tsconfig.json
├── presentation
│   └── README.md
├── scripts
│   ├── _pyrun.cmd
│   ├── _pyrun.sh
│   ├── log_antigravity.py
│   ├── log_hook.py
│   ├── log_manual.py
│   ├── setup.sh
│   ├── setup_hooks.ps1
│   ├── setup_hooks.sh
│   └── submit_log.py
├── specs
│   ├── compliance-notification.md
│   ├── interaction-checker.md
│   └── meal-planner.md
├── tasks
│   ├── README.md
│   ├── be1-ai-core.md
│   ├── be2-platform.md
│   ├── fe-frontend.md
│   └── roadmap-14-days.md
├── .dockerignore
├── .env
├── .env.example
├── .gitignore
├── ARCHITECTURE.md
├── CLAUDE.md
├── JOURNAL.md
├── Makefile
├── README.md
├── README_boilerplate.md
├── WORKLOG.md
├── docker-compose.yml
├── how_to_run.md
└── ruff.toml
```
