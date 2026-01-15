
import { jsPDF } from "jspdf";
import { TestData, UserAnswer, TestAnalytics } from "../types";

export const generatePDFReport = (
  testData: TestData,
  userAnswers: UserAnswer[],
  userName: string,
  testNumber: string,
  analytics: TestAnalytics
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Calculate Score
  let correctCount = 0;
  testData.questions.forEach(q => {
    const userVal = userAnswers.find(a => a.questionId === q.id)?.value.toLowerCase().trim() || "";
    const correctVal = q.answer.toLowerCase().trim();
    if (userVal === correctVal) correctCount++;
  });
  const total = testData.questions.length;

  // Aggregate Interaction History
  const pauseCount = analytics.events.filter(e => e.type === 'pause').length;
  const forwardSeekCount = analytics.events.filter(e => e.type === 'seek_forward').length;
  const backwardSeekCount = analytics.events.filter(e => e.type === 'seek_backward').length;
  const replayCount = analytics.replays;

  // Header
  doc.setFillColor(0, 51, 102); // #003366
  doc.rect(0, 0, pageWidth, 40, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("IELTS PERFORMANCE REPORT", pageWidth / 2, 25, { align: "center" });

  // Student & Tutor Info
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  
  doc.setFont("helvetica", "bold");
  doc.text(`Student:`, 15, 50);
  doc.setFont("helvetica", "normal");
  doc.text(userName || "Student", 45, 50);

  doc.setFont("helvetica", "bold");
  doc.text(`Tutor:`, 15, 56);
  doc.setFont("helvetica", "normal");
  doc.text("Lazizjon Isomiddinov", 45, 56);

  doc.setFont("helvetica", "bold");
  doc.text(`Test / Part:`, 15, 62);
  doc.setFont("helvetica", "normal");
  doc.text(`${testNumber} / ${testData.part}`, 45, 62);

  doc.setFont("helvetica", "bold");
  doc.text(`Level / Topic:`, 15, 68);
  doc.setFont("helvetica", "normal");
  doc.text(`${testData.level} • ${testData.title}`, 45, 68);

  // Score Box
  doc.setDrawColor(0, 51, 102);
  doc.setLineWidth(0.5);
  doc.rect(145, 45, 50, 25);
  doc.setFont("helvetica", "bold");
  doc.text("SCORE", 170, 52, { align: "center" });
  doc.setFontSize(18);
  doc.text(`${correctCount} / ${total}`, 170, 64, { align: "center" });

  // QUESTION-LEVEL ANALYSIS
  let y = 85;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 51, 102);
  doc.text("QUESTION-LEVEL ANALYSIS", 15, y);
  
  y += 5;
  doc.setFillColor(240, 240, 240);
  doc.rect(15, y, pageWidth - 30, 8, "F");
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text("Q#", 18, y + 6);
  doc.text("Result", 28, y + 6);
  doc.text("Your Answer", 50, y + 6);
  doc.text("Correct Answer", 95, y + 6);
  doc.text("Assistance", 145, y + 6);

  y += 12;
  testData.questions.forEach((q) => {
    const userAns = userAnswers.find(a => a.questionId === q.id)?.value || "---";
    const isCorrect = userAns.toLowerCase().trim() === q.answer.toLowerCase().trim();
    const assist = analytics.questionAssistance[q.id] || { lifeline: false, script: false };
    
    let helpStr = [];
    if (assist.lifeline) helpStr.push("50/50");
    if (assist.script) helpStr.push("SCRIPT");
    const finalHelp = helpStr.length > 0 ? helpStr.join("+") : "NONE";

    doc.text(`${q.id}`, 18, y);
    if (isCorrect) { doc.setTextColor(0, 120, 0); doc.text("CORRECT", 28, y); }
    else { doc.setTextColor(180, 0, 0); doc.text("WRONG", 28, y); }
    
    doc.setTextColor(0, 0, 0);
    doc.text(userAns, 50, y, { maxWidth: 40 });
    doc.text(q.answer, 95, y, { maxWidth: 45 });
    doc.text(finalHelp, 145, y);
    
    y += 8;
    if (y > 270) { doc.addPage(); y = 20; }
  });

  // ANALYTICS SUMMARY
  y += 15;
  if (y > 240) { doc.addPage(); y = 20; }

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 51, 102);
  doc.text("LISTENING ANALYTICS SUMMARY", 15, y);
  doc.setDrawColor(200, 200, 200);
  doc.line(15, y + 2, pageWidth - 15, y + 2);

  y += 12;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  
  doc.setFont("helvetica", "bold");
  doc.text("Quantity of Interactions:", 15, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.text(`• Total Audio Replays: ${replayCount}`, 20, y);
  y += 6;
  doc.text(`• Total Pauses: ${pauseCount}`, 20, y);
  y += 6;
  doc.text(`• Seek Forward Actions: ${forwardSeekCount}`, 20, y);
  y += 6;
  doc.text(`• Seek Backward Actions: ${backwardSeekCount}`, 20, y);

  // Footer Advice
  y = doc.internal.pageSize.getHeight() - 25;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  const assistCount = Object.values(analytics.questionAssistance).filter(a => a.lifeline || a.script).length;
  let advice = assistCount > 2 ? "High assistance used. Try reducing reliance on script/50-50 tools." : "Excellent independent listening performance.";
  doc.text(advice, pageWidth / 2, y, { align: "center" });

  doc.save(`IELTS_Report_${userName.replace(/\s+/g, '_')}.pdf`);
};
