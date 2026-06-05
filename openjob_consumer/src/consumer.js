require('dotenv').config();
const amqp = require('amqplib');
const nodemailer = require('nodemailer');
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  host: process.env.PGHOST,
  port: process.env.PGPORT,
});

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: parseInt(process.env.MAIL_PORT),
  secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASSWORD,
  },
});

const QUEUE_NAME = 'application_notifications';

const getConnectionUrl = () => {
  const { RABBITMQ_USER, RABBITMQ_PASSWORD, RABBITMQ_HOST, RABBITMQ_PORT } = process.env;
  return `amqp://${RABBITMQ_USER}:${RABBITMQ_PASSWORD}@${RABBITMQ_HOST}:${RABBITMQ_PORT}`;
};

const processApplication = async (applicationId) => {
  const result = await pool.query(
    `SELECT 
      a.id, a.created_at,
      u.name as applicant_name, u.email as applicant_email,
      j.title as job_title,
      owner.email as owner_email, owner.name as owner_name
     FROM applications a
     JOIN users u ON a.user_id = u.id
     JOIN jobs j ON a.job_id = j.id
     JOIN companies c ON j.company_id = c.id
     JOIN users owner ON c.user_id = owner.id
     WHERE a.id = $1`,
    [applicationId]
  );

  if (result.rows.length === 0) {
    console.log(`Application ${applicationId} not found`);
    return;
  }

  const { applicant_name, applicant_email, job_title, owner_email, owner_name, created_at } = result.rows[0];

  const mailOptions = {
    from: process.env.MAIL_USER,
    to: owner_email,
    subject: `New Application for ${job_title}`,
    html: `
      <h2>New Job Application Received</h2>
      <p>Hello ${owner_name},</p>
      <p>You have received a new application for <strong>${job_title}</strong>.</p>
      <table border="1" cellpadding="8" cellspacing="0">
        <tr><td><strong>Applicant Name</strong></td><td>${applicant_name}</td></tr>
        <tr><td><strong>Applicant Email</strong></td><td>${applicant_email}</td></tr>
        <tr><td><strong>Application Date</strong></td><td>${new Date(created_at).toLocaleString()}</td></tr>
      </table>
      <p>Please log in to review this application.</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${owner_email} for application ${applicationId}`);
  } catch (err) {
    console.error(`Failed to send email: ${err.message}`);
  }
};

const startConsumer = async () => {
  let connection;
  try {
    connection = await amqp.connect(getConnectionUrl());
    const channel = await connection.createChannel();
    await channel.assertQueue(QUEUE_NAME, { durable: true });
    channel.prefetch(1);

    console.log(`Consumer started, waiting for messages on queue: ${QUEUE_NAME}`);

    channel.consume(QUEUE_NAME, async (msg) => {
      if (!msg) return;
      try {
        const { application_id } = JSON.parse(msg.content.toString());
        console.log(`Processing application: ${application_id}`);
        await processApplication(application_id);
        channel.ack(msg);
      } catch (err) {
        console.error('Error processing message:', err.message);
        channel.nack(msg, false, false);
      }
    });

    process.on('SIGINT', async () => {
      await channel.close();
      await connection.close();
      process.exit(0);
    });

  } catch (err) {
    console.error('Consumer connection error:', err.message);
    console.log('Retrying in 5 seconds...');
    setTimeout(startConsumer, 5000);
  }
};

startConsumer();
