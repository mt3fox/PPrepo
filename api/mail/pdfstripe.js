const PDFDocument = require("pdfkit");
const SVGtoPDF = require("svg-to-pdfkit");
const fs = require("fs");
const path = require("path");

function generateInvoicePDF(invoice, thankYouNote) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
    });

    // Define the relative path to the SVG
    const svgPath = path.resolve(process.cwd(), "public/icon.svg");

    // Read the SVG file
    SVGtoPDF(doc, fs.readFileSync(svgPath, "utf8"), 50, 50, {
      width: 100,
      height: 100,
    });

    let buffers = [];
    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => {
      let pdfData = Buffer.concat(buffers);
      resolve(pdfData);
    });

    // Set some basic styles
    doc.font("Helvetica");

    // Header
    doc.fontSize(24).text("Invoice", { align: "right" });
    doc.fontSize(10).text(`#${invoice.invoice_number}`, { align: "right" });
    doc.moveDown();

    doc.moveUp(2); // Move up to align with "Invoice"
    doc.fontSize(16).text("PineApple Invoice.", { align: "left" });
    doc.moveDown(2);
    doc.fontSize(12).text("Billed From:", { underline: true });
    doc.fontSize(10).text(invoice.bill_from || "Stripe");
    doc.fontSize(10).text(invoice.bill_from_address_line_1 || "");
    doc.text(invoice.bill_from_address_line_2 || "");
    doc.text(
      `${invoice.bill_from_city || ""} ${invoice.bill_from_state || ""} ${
        invoice.bill_from_postal_code || ""
      }`
    );

    doc.text(invoice.bill_from_email || "");
    doc.text(invoice.bill_from_phone || "");

    doc.moveDown();

    // Billing Details
    doc.fontSize(12).text("Billed To:", { underline: true });
    doc.fontSize(10).text(invoice.bill_to);
    doc.text(invoice.bill_to_address_line_1);
    doc.text(invoice.bill_to_address_line_2);
    doc.text(
      `${invoice.bill_to_city}, ${invoice.bill_to_state} ${invoice.bill_to_postal_code}`
    );
    doc.text(invoice.bill_to_email);
    doc.text(invoice.bill_to_phone);

    doc.moveDown();

    // Invoice Details
    doc.fontSize(12).text("Invoice Details:", { underline: true });
    doc.fontSize(10).text(`Invoice Number: ${invoice.invoice_number}`);
    doc
      .fontSize(10)
      .text(
        `Issue Date: ${new Date(invoice.date_of_issue).toLocaleDateString()}`
      );
    doc.text(`Due Date: ${new Date(invoice.date_due).toLocaleDateString()}`);

    doc.moveDown();
    doc.moveDown();

    // Table Header
    const tableTop = 400;
    doc.font("Helvetica-Bold");
    doc.text("Item Description", 50, tableTop);
    doc.text("Quantity", 300, tableTop, { width: 90, align: "right" });
    doc.text("Unit Price", 400, tableTop, { width: 90, align: "right" });
    doc.text("Amount", 0, tableTop, { align: "right" });
    doc.moveDown();

    // Table Rows
    let yPos = tableTop + 25;
    doc.font("Helvetica");

    let totalAmount = 0;

    invoice.items.forEach((item, index) => {
      const lineHeight = 20;
      doc.text(item.description, 50, yPos);
      doc.text(item.quantity.toString(), 300, yPos, {
        width: 90,
        align: "right",
      });
      doc.text(parseFloat(item.unit_price).toFixed(2), 400, yPos, {
        width: 90,
        align: "right",
      });
      doc.text(parseFloat(item.subtotal).toFixed(2), 0, yPos, {
        align: "right",
      });

      totalAmount += parseFloat(item.subtotal);
      yPos += lineHeight;

      // Add a line between items
      if (index < invoice.items.length - 1) {
        doc.moveTo(50, yPos).lineTo(550, yPos).stroke();
        yPos += 10;
      }
    });

    // Totals
    let totalPos = yPos + 30;

    const currencySymbol = invoice.currency || "NA";
    // Print subtotal aligned to the right
    doc.text(`Subtotal:`, 300, totalPos);
    doc.text(
      `${currencySymbol}${parseFloat(totalAmount).toFixed(2)}`,
      0,
      totalPos,
      { align: "right" }
    );
    totalPos += 20; // Move position down for discount line
    // Assuming the discount is a percentage
    const discountValue = invoice.discount || "0"; // Default discount value if not provided
    doc.text("Discount % :", 300, totalPos);
    doc.text(discountValue, 0, totalPos, { align: "right" });
    totalPos += 20; // Move position down for total line

    // Calculate total after discount if needed
    const discountAmount = totalAmount * (parseFloat(discountValue) / 100) || 0; // Ensure discount is numeric
    const finalTotal = totalAmount - discountAmount;

    doc.text("Total:", 300, totalPos);
    doc.font("Helvetica-Bold");
    doc.text(`${currencySymbol}${finalTotal.toFixed(2)}`, 0, totalPos, {
      align: "right",
    });

    // Footer
    doc.fontSize(10).text(thankYouNote, 50, 700, {
      align: "center",
      width: 500,
    });

    doc.end();
  });
}

module.exports = generateInvoicePDF;
