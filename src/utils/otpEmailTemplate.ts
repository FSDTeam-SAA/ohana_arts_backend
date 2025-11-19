export const otpEmailTemplate = (otp: string) => `
<!DOCTYPE html>
<html>
  <body style="font-family: Arial, sans-serif; background:#f4f4f4; padding:20px;">
    <div style="
      max-width:500px; 
      margin:auto; 
      background:#ffffff; 
      padding:25px; 
      border-radius:8px; 
      box-shadow:0 4px 12px rgba(0,0,0,0.1);
    ">
      <h2 style="text-align:center; color:#333;">Password Reset OTP</h2>
      <p>Hello,</p>
      <p>Your One-Time Password (OTP) for resetting your password is:</p>

      <div style="
        margin:20px auto; 
        text-align:center; 
        font-size:32px; 
        font-weight:bold; 
        letter-spacing:6px; 
        background:#f1f1f1; 
        padding:15px; 
        border-radius:6px;
      ">
        ${otp}
      </div>

      <p style="color:#444;">
        This OTP will expire in <strong>10 minutes</strong>.  
        If you did not request a password reset, please ignore this email.
      </p>

      <p style="margin-top:30px; font-size:12px; color:#777; text-align:center;">
        © ${new Date().getFullYear()} Your App Name
      </p>
    </div>
  </body>
</html>
`;
