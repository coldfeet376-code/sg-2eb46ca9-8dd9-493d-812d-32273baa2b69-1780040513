import type { NextApiRequest, NextApiResponse } from "next";
import { Resend } from "resend";
import { supabase } from "@/integrations/supabase/client";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { email, code, userName } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Check if Resend API key is configured
    if (!process.env.RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured");
      return res.status(500).json({ 
        error: "Email service not configured"
      });
    }

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.6;
              color: #1a1a1a;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .container {
              background: #ffffff;
              border: 1px solid #e5e5e5;
              border-radius: 8px;
              padding: 40px;
              text-align: center;
            }
            .logo {
              font-size: 24px;
              font-weight: 700;
              color: #2d5c84;
              letter-spacing: -0.5px;
              margin-bottom: 30px;
            }
            .title {
              font-size: 20px;
              font-weight: 600;
              margin: 20px 0;
              color: #1a1a1a;
            }
            .code-box {
              background: #f5f5f5;
              border: 2px dashed #2d5c84;
              border-radius: 8px;
              padding: 30px;
              margin: 30px 0;
            }
            .code {
              font-size: 36px;
              font-weight: 700;
              color: #2d5c84;
              letter-spacing: 8px;
              font-family: 'Courier New', monospace;
            }
            .warning {
              background: #fff4e5;
              border-left: 4px solid #ff9800;
              padding: 12px 16px;
              margin: 20px 0;
              text-align: left;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #e5e5e5;
              font-size: 12px;
              color: #999;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">GIST WAREHOUSE ROTA</div>
            
            <div class="title">Your Login Verification Code</div>
            
            <p>Hi ${userName || "there"},</p>
            
            <p>Use this code to complete your login:</p>
            
            <div class="code-box">
              <div class="code">${code}</div>
            </div>
            
            <div class="warning">
              <strong>⏱️ This code expires in 5 minutes</strong><br>
              For security, don't share this code with anyone.
            </div>
            
            <p style="color: #666; font-size: 14px;">
              If you didn't try to log in, please ignore this email or contact your administrator.
            </p>
            
            <div class="footer">
              <p>This is an automated security message from GIST Warehouse Rota System.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send email via Resend
    const { data, error } = await resend.emails.send({
      from: "GIST Rota Security <onboarding@resend.dev>",
      to: email,
      subject: `Your verification code: ${code}`,
      html: emailHtml,
    });

    if (error) {
      console.error("Resend error:", error);
      return res.status(500).json({ 
        error: "Failed to send email",
        details: error.message
      });
    }

    console.log(`✅ 2FA code sent to ${email} (ID: ${data?.id})`);

    res.status(200).json({ 
      success: true, 
      message: "Verification code sent",
      emailId: data?.id
    });

  } catch (error) {
    console.error("2FA email error:", error);
    res.status(500).json({ 
      error: "Failed to send verification code",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}