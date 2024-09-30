const JSZip = require("jszip");
const { supabase } = require("../config/config");
const { Readable } = require("stream");
const generateInvoice = require("../mail/pdfstripe");

const bulkActionsController = {
  DownloadAllPdf: async (req, res) => {
    try {
      const { ids } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res
          .status(400)
          .json({ error: "Invalid or missing invoice IDs" });
      }

      // Fetch all invoices based on the array of ids
      const { data: invoices, error } = await supabase
        .from("demoinvoices")
        .select("*")
        .in("id", ids); // Using .in() to fetch multiple invoices

      if (error) throw error;
      if (invoices.length === 0)
        return res.status(404).json({ error: "Invoices not found" });

      // Create a new Zip archive
      const zip = new JSZip();

      for (const invoice of invoices) {
        const thankYouNote =
          invoice?.thankyou_note || "Thank you for your business!";

        // Ensure invoice has valid items, or create a default item
        if (!Array.isArray(invoice.items) || invoice.items.length === 0) {
          invoice.items = [
            {
              description: invoice.description || "Service",
              quantity: invoice.quantity || 1,
              unit_price:
                invoice.unit_price ||
                parseFloat(invoice.total.replace("$", "")),
              subtotal:
                invoice.subtotal || parseFloat(invoice.total.replace("$", "")),
            },
          ];
        }

        // Generate the PDF for each invoice
        const pdf = await generateInvoice(invoice, thankYouNote);

        // Add the generated PDF to the Zip archive with a unique filename
        zip.file(`Invoice-${invoice.invoice_number}.pdf`, pdf);
      }

      // Generate the zip file
      const zipData = await zip.generateAsync({ type: "nodebuffer" });

      // Send the Zip file as a response
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename=Invoices.zip`);
      res.send(zipData);
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ message: "Error downloading invoices", error: error.message });
    }
  },
  markPaidBulk: async (req, res) => {
    try {
      const { invoiceIds, paidStatus } = req.body; // Get the invoice IDs and status from the request body

      if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
        return res.status(400).json({ message: "No invoice IDs provided" });
      }

      // Update all specified invoices to mark them as paid/unpaid
      const { data, error } = await supabase
        .from("demoinvoices")
        .update({ paidstripe: paidStatus, paidmanual: paidStatus }) // Update both fields
        .in("id", invoiceIds) // Use .in() to match multiple IDs
        .select();

      if (error) throw error;

      res.status(200).json({
        message: `Invoices marked as ${
          paidStatus ? "paid" : "unpaid"
        } successfully`,
        invoices: data, // Return the updated invoices
      });
    } catch (error) {
      console.error("Error marking invoices as paid/unpaid:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  SendAllEmails: (req, res) => {},
  DeleteAllInvoices: async (req, res) => {
    const { ids } = req.body; // Expecting an array of invoice IDs

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "Invalid or empty IDs array" });
    }

    try {
      // Fetch the invoices to be deleted
      const { data: invoices, error: fetchError } = await supabase
        .from("demoinvoices")
        .select("*")
        .in("id", ids);

      if (fetchError) {
        throw fetchError;
      }

      if (invoices.length === 0) {
        return res
          .status(404)
          .json({ message: "No invoices found for the provided IDs" });
      }

      // Insert invoices into the deleted_invoices table
      const deletedInvoices = invoices.map((invoice) => ({
        id: invoice.id,
        user_id: invoice.user_id,
        invoice_number: invoice.invoice_number,
        deleted_at: new Date().toISOString(),
      }));

      const { error: insertError } = await supabase
        .from("deleted_invoices")
        .insert(deletedInvoices);

      if (insertError) {
        throw insertError;
      }

      // Delete the invoices from the demoinvoices table
      const { error: deleteError } = await supabase
        .from("demoinvoices")
        .delete()
        .in("id", ids);

      if (deleteError) {
        throw deleteError;
      }

      res.status(200).json({ message: "Invoices deleted successfully" });
    } catch (error) {
      console.error("Error deleting invoices:", error);
      res.status(500).json({ message: "Unable to delete invoices" });
    }
  },
};

module.exports = bulkActionsController;
