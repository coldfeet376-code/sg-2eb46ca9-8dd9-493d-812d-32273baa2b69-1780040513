import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Assignment {
  date: string;
  task: string;
  staffName: string;
  staffId: string;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const generateRotaPDF = (
  assignments: Assignment[],
  weekStart: Date,
  weekEnd: Date
): void => {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  // Minimal margins for maximum space
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 10;

  // Header - compact
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Weekly Rota", margin, 15);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const dateRange = `${weekStart.toLocaleDateString("en-GB")} - ${weekEnd.toLocaleDateString("en-GB")}`;
  doc.text(dateRange, pageWidth - margin, 15, { align: "right" });

  // Group assignments by date
  const assignmentsByDate = new Map<string, Assignment[]>();
  assignments.forEach((assignment) => {
    if (!assignmentsByDate.has(assignment.date)) {
      assignmentsByDate.set(assignment.date, []);
    }
    assignmentsByDate.get(assignment.date)!.push(assignment);
  });

  // Generate 7 days starting from weekStart
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    dates.push(date);
  }

  // Get all unique tasks
  const allTasks = Array.from(new Set(assignments.map(a => a.task))).sort();

  // Build table data
  const tableData: any[][] = [];
  
  allTasks.forEach((task) => {
    const row: any[] = [{ content: task, styles: { fontStyle: "bold", fillColor: [240, 240, 240] } }];
    
    dates.forEach((date) => {
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const dayAssignments = assignmentsByDate.get(dateStr) || [];
      const taskAssignment = dayAssignments.find(a => a.task === task);
      
      row.push(taskAssignment ? taskAssignment.staffName : "-");
    });
    
    tableData.push(row);
  });

  // Table headers - compact day names
  const headers = [
    "Task",
    ...dates.map((date) => {
      const dayName = DAYS[date.getDay()].substring(0, 3); // 3-letter abbreviation
      const dayDate = date.getDate();
      return `${dayName}\n${dayDate}`;
    })
  ];

  // Generate table with optimized settings for single page
  autoTable(doc, {
    head: [headers],
    body: tableData,
    startY: 22,
    margin: { left: margin, right: margin },
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: 2,
      overflow: "linebreak",
      halign: "center",
      valign: "middle",
    },
    headStyles: {
      fillColor: [70, 130, 180],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
      halign: "center",
    },
    columnStyles: {
      0: { 
        cellWidth: 25, 
        halign: "left",
        fontStyle: "bold",
      },
    },
    didParseCell: (data: any) => {
      // Make task column distinct
      if (data.column.index === 0 && data.section === 'body') {
        data.cell.styles.fillColor = [245, 245, 245];
      }
    },
  });

  // Footer - minimal
  const finalY = (doc as any).lastAutoTable.finalY || 100;
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text(
    `Generated: ${new Date().toLocaleDateString("en-GB")} ${new Date().toLocaleTimeString("en-GB")}`,
    pageWidth / 2,
    doc.internal.pageSize.getHeight() - 5,
    { align: "center" }
  );

  // Save
  const filename = `rota-${weekStart.toISOString().split("T")[0]}.pdf`;
  doc.save(filename);
};

// Manager duties PDF generation (unchanged for now)
export const generateManagerDutiesPDF = (
  duties: any[],
  weekStart: Date,
  weekEnd: Date
): void => {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 10;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Manager Duties", margin, 15);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const dateRange = `${weekStart.toLocaleDateString("en-GB")} - ${weekEnd.toLocaleDateString("en-GB")}`;
  doc.text(dateRange, pageWidth - margin, 15, { align: "right" });

  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    dates.push(date);
  }

  const allDuties = Array.from(new Set(duties.map(d => d.duty))).sort();

  const tableData: any[][] = [];
  
  allDuties.forEach((duty) => {
    const row: any[] = [{ content: duty, styles: { fontStyle: "bold", fillColor: [240, 240, 240] } }];
    
    dates.forEach((date) => {
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const dayDuties = duties.filter(d => d.date === dateStr);
      const dutyAssignment = dayDuties.find(d => d.duty === duty);
      
      row.push(dutyAssignment ? dutyAssignment.managerName : "-");
    });
    
    tableData.push(row);
  });

  const headers = [
    "Duty",
    ...dates.map((date) => {
      const dayName = DAYS[date.getDay()].substring(0, 3);
      const dayDate = date.getDate();
      return `${dayName}\n${dayDate}`;
    })
  ];

  autoTable(doc, {
    head: [headers],
    body: tableData,
    startY: 22,
    margin: { left: margin, right: margin },
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: 2,
      overflow: "linebreak",
      halign: "center",
      valign: "middle",
    },
    headStyles: {
      fillColor: [70, 130, 180],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
      halign: "center",
    },
    columnStyles: {
      0: { 
        cellWidth: 25, 
        halign: "left",
        fontStyle: "bold",
      },
    },
  });

  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text(
    `Generated: ${new Date().toLocaleDateString("en-GB")} ${new Date().toLocaleTimeString("en-GB")}`,
    pageWidth / 2,
    doc.internal.pageSize.getHeight() - 5,
    { align: "center" }
  );

  const filename = `manager-duties-${weekStart.toISOString().split("T")[0]}.pdf`;
  doc.save(filename);
};