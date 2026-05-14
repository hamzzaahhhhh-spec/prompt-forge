# PromptForge

PromptForge is a sophisticated Next.js application designed for prompt engineering and transformation. It allows users to refine, optimize, and manage their AI prompts with a beautiful and intuitive interface.

## Features

- **Prompt Transformation**: Refine and optimize prompts using advanced engine logic.
- **Real-time Stats**: Admin dashboard for monitoring system performance and usage.
- **Custom Cursor**: Interactive and smooth UI experience.
- **History Management**: Keep track of your previous prompts and optimizations.
- **Variant Tabs**: Easily switch between different prompt versions.
- **Customizable UI**: High-performance animations powered by GSAP and Motion.

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Animations**: [GSAP](https://gsap.com/), [Motion (Framer Motion)](https://motion.dev/)
- **Smooth Scroll**: [Lenis](https://github.com/darkroomengineering/lenis)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Testing**: [Vitest](https://vitest.dev/)
- **Programming Language**: [TypeScript](https://www.typescriptlang.org/)

## Getting Started

### Prerequisites

- Node.js (Latest LTS recommended)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/hamzzaahhhhh-spec/prompt-forge.git
   cd prompt-forge
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Copy `.env.example` to `.env.local` and fill in the required values.

4. Run the development server:
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Admin Features

The project includes an admin dashboard located at `/admin`. You can monitor real-time stats and manage the application.

To run the realtime manager:
```powershell
npm run manager:realtime
```

## Testing

Run the test suite using Vitest:
```bash
npm test
```

## License

This project is private and for demonstration purposes.
