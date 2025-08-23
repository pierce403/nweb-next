# nweb Testing Tools

This directory contains tools for generating fake test data for the nweb analyst application.

## Quick Start

### Quick Options

**Option 1: Empty Database (for UI testing)**
```bash
./run-analyst.sh
```
Starts the analyst with an empty database for testing UI components.

**Option 2: Demo Data (for full testing)**
```bash
cd testing && ./populate_demo_data.sh
```
Generates realistic fake data and starts the analyst with populated demo data.

**Option 3: One-liner setup (for development)**
```bash
cd testing && ./setup_test_data.sh
```

This will:
- Set up the Python virtual environment
- Install dependencies
- Generate fake data
- Copy the database to the project root

### Manual Setup

If you prefer to do it step by step:

1. Set up virtual environment:
   ```bash
   cd testing
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

2. Generate fake data:
   ```bash
   python generate_fake_data.py
   ```

3. Copy database to project root:
   ```bash
   cp nweb-analyst.db ../
   ```

4. Start analyst:
   ```bash
   cd ..
   ./run-analyst.sh
   ```

### Available Scripts

- **`setup_test_data.sh`**: Complete setup with virtual environment and fake data generation
- **`populate_demo_data.sh`**: Quick demo data population and analyst startup
- **`generate_fake_data.py`**: Python script for generating fake data
- **`requirements.txt`**: Python dependencies for the testing tools

### What it generates

The script creates realistic test data including:

- **Submissions**: Scan job submissions with various statuses (pending, processing, completed, failed)
- **Records**: Individual scan results with IP addresses, ports, services, and metadata
- **Indexer State**: Current state of the indexer

### Configuration

You can customize the data generation by modifying the parameters in the `main()` function:

```python
# Generate 20 submissions with ~100 records each
submissions, records = await generator.generate_fake_data(
    num_submissions=20,
    records_per_submission=100
)
```

### Database Location

By default, the script uses `./nweb-analyst.db` (relative to the project root). You can specify a different location:

```python
generator = FakeDataGenerator(db_path="/path/to/your/database.db")
```

### Sample Output

```
🚀 nweb Fake Data Generator
==================================================
✅ Database initialized
🎭 Generating fake data: 20 submissions, ~2000 records
📝 Created 5/20 submissions
📊 Created records for 5/20 submissions
...
✅ Generated 20 submissions and 2345 records

📊 Database Statistics:
   Submissions: 20
   Records: 2345
   Unique IPs: 1876
   Unique Services: 12

✅ Fake data generation completed successfully!
📁 Database file: ./nweb-analyst.db
```

### Integration with Analyst

After generating fake data, you can:

1. Start the analyst server:
   ```bash
   ./run-analyst.sh
   ```

2. The analyst will automatically use the PGLite database with your fake data

3. Visit http://localhost:3000 to explore the data

### Data Realism

The generated data includes:

- Realistic IP addresses (mix of private and public ranges)
- Common network services (SSH, HTTP, HTTPS, MySQL, PostgreSQL, etc.)
- Varied scan results (open, closed, filtered ports)
- Realistic timestamps and metadata
- Geographic distribution (vantage points)
- Tool-specific information (nmap, masscan, etc.)

This provides a comprehensive dataset for testing the analyst application's features including:
- Dashboard statistics
- Search functionality
- Data visualization
- Filtering and sorting
- Performance under load
