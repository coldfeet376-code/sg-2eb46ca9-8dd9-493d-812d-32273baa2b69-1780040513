import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/integrations/supabase/client";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { email, inviteUrl, invitedByName } = req.body;

    if (!email || !inviteUrl) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Use Supabase's built-in email sending via Auth
    // This sends a custom email with the invite link
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
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .logo {
              font-size: 24px;
              font-weight: 700;
              color: #2d5c84;
              letter-spacing: -0.5px;
            }
            .title {
              font-size: 20px;
              font-weight: 600;
              margin: 20px 0;
              color: #1a1a1a;
            }
            .content {
              color: #4a4a4a;
              margin: 20px 0;
            }
            .button {
              display: inline-block;
              background: #2d5c84;
              color: #ffffff;
              text-decoration: none;
              padding: 14px 32px;
              border-radius: 6px;
              font-weight: 600;
              margin: 24px 0;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #e5e5e5;
              font-size: 12px;
              color: #999;
              text-align: center;
            }
            .link {
              color: #2d5c84;
              word-break: break-all;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">GIST WAREHOUSE ROTA</div>
            </div>
            
            <div class="title">You've been invited!</div>
            
            <div class="content">
              <p>Hi there,</p>
              
              <p>${invitedByName || "Your manager"} has invited you to join the GIST Warehouse Rota System.</p>
              
              <p>Click the button below to create your account and get started:</p>
              
              <div style="text-align: center;">
                <a href="${inviteUrl}" class="button">Accept Invitation</a>
              </div>
              
              <p>Or copy and paste this link into your browser:</p>
              <p class="link">${inviteUrl}</p>
              
              <p><strong>Note:</strong> This invitation link will expire in 7 days.</p>
            </div>
            
            <div class="footer">
              <p>This is an automated message from GIST Warehouse Rota System.</p>
              <p>If you didn't expect this email, you can safely ignore it.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // For now, we'll log the email content
    // In production, you would integrate with an email service like:
    // - Resend (npm install resend)
    // - SendGrid (npm install @sendgrid/mail)
    // - AWS SES
    // - Supabase Edge Function with email provider
    
    console.log("=== EMAIL CONTENT ===");
    console.log(`To: ${email}`);
    console.log(`Subject: You've been invited to GIST Warehouse Rota`);
    console.log(`Invite URL: ${inviteUrl}`);
    console.log("=====================");

    // TODO: Integrate with actual email service
    // Example with Resend:
    // const resend = new Resend(process.env.RESEND_API_KEY);
    // await resend.emails.send({
    //   from: 'GIST Rota <noreply@gistworld.com>',
    //   to: email,
    //   subject: "You've been invited to GIST Warehouse Rota",
    //   html: emailHtml,
    // });

    // For development/testing, return success
    // In production, only return success after actual email send
    res.status(200).json({ 
      success: true, 
      message: "Email logged (integrate email service in production)" 
    });

  } catch (error) {
    console.error("Email send error:", error);
    res.status(500).json({ 
      error: "Failed to send email",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}