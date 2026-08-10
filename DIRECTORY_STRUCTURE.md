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
│   ├── api
│   ├── app
│   │   ├── (auth)
│   │   ├── doctor
│   │   │   ├── messages
│   │   │   │   ├── [conversationId]
│   │   │   │   │   └── page.tsx
│   │   │   │   └── page.tsx
│   │   │   ├── patients
│   │   │   │   ├── [patientId]
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── compliance
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── constraints
│   │   │   │   │   └── page.tsx
│   │   │   │   └── page.tsx
│   │   │   ├── reviews
│   │   │   │   ├── [planId]
│   │   │   │   │   └── page.tsx
│   │   │   │   └── page.tsx
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── patient
│   │   │   ├── assistant
│   │   │   │   └── page.tsx
│   │   │   ├── history
│   │   │   │   └── page.tsx
│   │   │   ├── meals
│   │   │   │   ├── log
│   │   │   │   │   └── page.tsx
│   │   │   │   └── page.tsx
│   │   │   ├── messages
│   │   │   │   └── page.tsx
│   │   │   ├── notifications
│   │   │   │   └── page.tsx
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components
│   │   └── shared
│   │       ├── AppShell.tsx
│   │       ├── MobileMenuContext.tsx
│   │       ├── Sidebar.tsx
│   │       └── TopBar.tsx
│   ├── hooks
│   ├── lib
│   │   └── nav-config.ts
│   ├── public
│   ├── services
│   ├── store
│   ├── utils
│   ├── .env.local.example
│   ├── .eslintrc.json
│   ├── Dockerfile
│   ├── eslint.config.mjs
│   ├── next-env.d.ts
│   ├── next.config.mjs
│   ├── package-lock.json
│   ├── package.json
│   ├── postcss.config.mjs
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── tsconfig.tsbuildinfo
├── ui
│   └── stitch_vmec_10_health_assistant
│       ├── compliance
│       │   ├── code.html
│       │   └── screen.png
│       ├── constraints
│       │   ├── code.html
│       │   └── screen.png
│       ├── dashboard
│       │   ├── code.html
│       │   └── screen.png
│       ├── landing
│       │   ├── code.html
│       │   └── screen.png
│       ├── messages
│       │   ├── code.html
│       │   └── screen.png
│       ├── patients
│       │   └── [patientId]
│       │       ├── code.html
│       │       └── screen.png
│       ├── reviews
│       │   ├── code.html
│       │   └── screen.png
│       ├── reviews_
│       │   ├── code.html
│       │   └── screen.png
│       └── sign-in
│           ├── code.html
│           └── screen.png
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
├── FRONTEND_STRUCTURE.md
├── JOURNAL.md
├── Makefile
├── README.md
├── README_boilerplate.md
├── WORKLOG.md
├── docker-compose.yml
├── how_to_run.md
└── ruff.toml
```
