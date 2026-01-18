# Yukyu Pro - Advanced Leave Management System (UNS)

**Yukyu Pro** is a modern, enterprise-grade web application designed to manage employee paid leave (Yukyu) compliance in Japan. It helps organizations adhere to the legal requirement for employees with 10+ granted days to take at least 5 days of paid leave annually.

The application features a premium, dark-themed UI ("Premium Analog" aesthetic) and integrates with Google's Gemini AI to provide intelligent insights regarding compliance risks.

## 🌟 Key Features

*   **Dashboard Overview**: Real-time visualization of leave usage, compliance status, and "at-risk" employees.
*   **AI Compliance Advisor**: Integrated with **Google Gemini 2.0 Flash** to analyze employee data and generate actionable compliance reports and risk assessments.
*   **Excel Integration**: Seamlessly import and export employee data using Excel files (`.xlsx`), ensuring compatibility with existing HR workflows.
*   **Smart Leave Request**: Intuitive interface for logging leave, with automatic validation against remaining balances.
*   **Reports & Accounting**: Generate detailed accounting reports and visual analytics for management review.
*   **Digital Hanko Workflow**: Japanese-style digital approval stamps for authentic document processing.
*   **Premium UI/UX**: Built with React 19 and Tailwind CSS, featuring smooth animations (Framer Motion) and a high-end "Dark Mode" aesthetic.

## 🛠️ Tech Stack

*   **Frontend**: React 19, TypeScript, Vite 6
*   **Styling**: Tailwind CSS, Framer Motion (Animations)
*   **AI Engine**: Google GenAI SDK (`gemini-2.0-flash`)
*   **Data Handling**: SheetJS (`xlsx`) for Excel, `jspdf` for PDF generation
*   **Visualization**: Recharts
*   **State Management**: Local State + Persistence (Serverless Architecture)

## 🚀 Getting Started

### Prerequisites

*   Node.js (v18 or higher)
*   npm (v9 or higher)

### Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/jokken79/yukyuantiguov1.0.git
    cd yukyuantiguov1.0
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Environment Setup**:
    Create a `.env.local` file in the root directory and add your Google Gemini API key:
    ```env
    VITE_GEMINI_API_KEY=your_actual_api_key_here
    ```

### Running the Application

**Option 1: Using the automated script (Windows)**
Run the included batch file in the `scripts` folder:
```bash
scripts/start_app.bat
```
Follow the on-screen prompts to select a port (default: 3000).

**Option 2: Manual Start**
```bash
npm run dev
```

## 📂 Project Structure

*   `/src`: Source code
    *   `/components`: UI components (Dashboard, EmployeeList, etc.)
    *   `/services`: Logic for AI, database, and validation
    *   `/types`: TypeScript definitions
*   `/scripts`: Utility scripts for setup and launching

## 🛡️ License

Private / Internal Use Only.