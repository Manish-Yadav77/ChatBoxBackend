import nodemailer from 'nodemailer';
import dotenv from "dotenv";
dotenv.config();

const transporter = nodemailer.createTransport({
    service:'gmail',
    auth:{
        user:process.env.EMAIL_USER,
        pass:process.env.EMAIL_PASS 
    }
})
const sendMail = async(to,subject,text,html)=>{
    try {
        await transporter.sendMail({
            from:process.env.EMAIL_USER,
            to,
            subject,
            text,
            html
        })
        console.log(`Email sent to ${to}`);
        
    } catch (error) {
        console.log("error in sending email is here :\n",error);  
    }
}
export default sendMail;