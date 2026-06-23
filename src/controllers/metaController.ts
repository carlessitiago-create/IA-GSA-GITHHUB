import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

export const metaConversionsHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        pixelId,
        token,
        eventName,
        eventTime,
        userData,
        customData,
        eventSourceUrl,
        actionSource
      } = req.body;

      if (!pixelId || !token || !eventName) {
        return res.status(400).json({ error: "Missing required parameters for Meta Conversions API" });
      }

      const url = `https://graph.facebook.com/v19.0/${pixelId}/events`;

      const hashData = (val: string) => {
        if (!val) return "";
        return crypto.createHash("sha256").update(val.trim().toLowerCase()).digest("hex");
      };

      const hashedUserData: any = { ...userData };
      if (hashedUserData.em && !/^[a-f0-9]{64}$/.test(hashedUserData.em)) {
        hashedUserData.em = hashData(hashedUserData.em);
      }
      if (hashedUserData.ph && !/^[a-f0-9]{64}$/.test(hashedUserData.ph)) {
        hashedUserData.ph = hashData(hashedUserData.ph.replace(/\D/g, ""));
      }

      const payload = {
        data: [
          {
            event_name: eventName,
            event_time: eventTime || Math.floor(Date.now() / 1000),
            action_source: actionSource || "website",
            event_source_url: eventSourceUrl,
            user_data: hashedUserData,
            custom_data: {
              ...customData
            }
          }
        ]
      };

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const responseJson = await response.json();
      
      if (!response.ok) {
        console.error("Meta Conversions API Error:", JSON.stringify(responseJson));
        return res.status(response.status).json(responseJson);
      }

      res.json({ success: true, meta_response: responseJson });
    } catch (error: any) {
      next(error);
    }
};
