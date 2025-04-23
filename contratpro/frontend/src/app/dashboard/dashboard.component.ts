import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { Chart, ChartConfiguration, ChartOptions, registerables, ChartTypeRegistry } from 'chart.js';

// Register all Chart.js components
Chart.register(...registerables);
import { NavbarComponent } from "../navbar/navbar.component";
import { FooterComponent } from "../footer/footer.component";
import { CommonModule } from '@angular/common';
import { ContractService } from '../services/contract.service';
import { SignedContractService } from '../services/signed-contract.service';
import { UnsignedContractService } from '../services/unsigned-contract.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  imports: [NavbarComponent, FooterComponent, CommonModule],
})
export class DashboardComponent implements OnInit, AfterViewInit {
  @ViewChild('activityChart') activityChartRef!: ElementRef;
  @ViewChild('completionChart') completionChartRef!: ElementRef;

  currentDate = new Date();
  filterPeriod: 'week' | 'month' | 'quarter' | 'year' = 'month';
  activityChart: Chart | null = null;
  completionChart: Chart | null = null;

  metrics = {
    active: 0,
    signed: 0,
    unsigned: 0,
    total: 0
  };

  contracts: any[] = [];
  signedContracts: any[] = [];
  unsignedContracts: any[] = [];
  filteredContracts: any[] = [];

  activeTab: 'all' | 'signed' | 'unsigned' = 'all';

  // Dark theme chart colors
  chartColors = {
    primary: '#7c3aed',      // --primary
    primaryLight: '#8b5cf6', // --primary-light
    primaryDark: '#6d28d9',  // --primary-dark
    error: '#ef4444',        // --error
    success: '#22c55e',      // --success
    textWhite: '#ffffff',    // --text-white
    textGray: '#cccccc'      // --text-light-gray
  };

  constructor(
    private router: Router,
    private contractService: ContractService,
    private signedContractService: SignedContractService,
    private unsignedContractService: UnsignedContractService
  ) {}

  ngOnInit(): void {
    this.setCurrentDate();
    this.loadDashboardData();
  }

  ngAfterViewInit(): void {
    // Initialize charts after view is initialized
    // Use a timeout to ensure the DOM is fully rendered
    setTimeout(() => {
      this.initCharts();
    }, 300);
  }

  private setCurrentDate(): void {
    this.currentDate = new Date();
  }

  loadDashboardData(): void {
    console.log('Loading dashboard data...');

    // Load signed contracts
    this.signedContractService.getSignedContracts().subscribe(
      data => {
        console.log('Signed contracts response:', data);

        // Handle different response formats
        if (data && data.data) {
          this.signedContracts = data.data;
        } else if (Array.isArray(data)) {
          this.signedContracts = data;
        } else if (data && data.current_page) {
          // Laravel pagination format
          this.signedContracts = data.data || [];
        } else {
          this.signedContracts = [];
        }

        console.log('Processed signed contracts:', this.signedContracts);

        // Load unsigned contracts
        this.unsignedContractService.getUnsignedContracts().subscribe(
          data => {
            console.log('Unsigned contracts response:', data);

            // Handle different response formats
            if (data && data.data) {
              this.unsignedContracts = data.data;
            } else if (Array.isArray(data)) {
              this.unsignedContracts = data;
            } else if (data && data.current_page) {
              // Laravel pagination format
              this.unsignedContracts = data.data || [];
            } else {
              this.unsignedContracts = [];
            }

            console.log('Processed unsigned contracts:', this.unsignedContracts);

            // Combine all contracts for the 'all' tab
            this.contracts = [
              ...this.signedContracts.map(contract => ({
                ...contract,
                type: 'signed',
                status: 'signed',
                client: contract.nom_contrat || 'Unnamed Contract',
                startDate: new Date(contract.created_at),
                progress: 100
              })),
              ...this.unsignedContracts.map(contract => ({
                ...contract,
                type: 'unsigned',
                status: contract.status || 'pending',
                client: contract.nom_contrat || 'Unnamed Contract',
                startDate: new Date(contract.created_at),
                progress: 50
              }))
            ];

            console.log('Combined contracts:', this.contracts);

            // Update filtered contracts based on active tab
            this.updateFilteredContracts();
            console.log('Filtered contracts:', this.filteredContracts);

            // Calculate metrics
            this.calculateMetrics();
            console.log('Metrics:', this.metrics);

            // Update charts
            this.updateCharts();
          },
          error => {
            console.error('Error fetching unsigned contracts:', error);
            this.unsignedContracts = [];
            this.updateFilteredContracts();
            this.calculateMetrics();
            this.updateCharts();
          }
        );
      },
      error => {
        console.error('Error fetching signed contracts:', error);
        this.signedContracts = [];

        // Still try to load unsigned contracts
        this.unsignedContractService.getUnsignedContracts().subscribe(
          data => {
            console.log('Unsigned contracts response (after signed error):', data);

            // Handle different response formats
            if (data && data.data) {
              this.unsignedContracts = data.data;
            } else if (Array.isArray(data)) {
              this.unsignedContracts = data;
            } else if (data && data.current_page) {
              // Laravel pagination format
              this.unsignedContracts = data.data || [];
            } else {
              this.unsignedContracts = [];
            }

            // Update contracts and UI
            this.contracts = this.unsignedContracts.map(contract => ({
              ...contract,
              type: 'unsigned',
              status: contract.status || 'pending',
              client: contract.nom_contrat || 'Unnamed Contract',
              startDate: new Date(contract.created_at),
              progress: 50
            }));

            this.updateFilteredContracts();
            this.calculateMetrics();
            this.updateCharts();
          },
          error => {
            console.error('Error fetching unsigned contracts after signed error:', error);
            this.unsignedContracts = [];
            this.contracts = [];
            this.filteredContracts = [];
            this.calculateMetrics();
            this.updateCharts();
          }
        );
      }
    );
  }

  calculateMetrics(): void {
    this.metrics.signed = this.signedContracts.length;
    this.metrics.unsigned = this.unsignedContracts.length;
    this.metrics.active = this.unsignedContracts.filter(c => c.status === 'pending').length;
    this.metrics.total = this.contracts.length;
  }

  updateFilteredContracts(): void {
    switch (this.activeTab) {
      case 'signed':
        this.filteredContracts = this.signedContracts.map(contract => ({
          ...contract,
          type: 'signed',
          status: 'signed',
          client: contract.nom_contrat,
          startDate: new Date(contract.created_at),
          progress: 100
        }));
        break;
      case 'unsigned':
        this.filteredContracts = this.unsignedContracts.map(contract => ({
          ...contract,
          type: 'unsigned',
          status: contract.status || 'pending',
          client: contract.nom_contrat,
          startDate: new Date(contract.created_at),
          progress: 50
        }));
        break;
      default: // 'all'
        this.filteredContracts = [...this.contracts];
        break;
    }
  }

  setFilterPeriod(period: 'week' | 'month' | 'quarter' | 'year'): void {
    this.filterPeriod = period;
    this.loadDashboardData();
  }

  searchContracts(event: Event): void {
    const searchTerm = (event.target as HTMLInputElement).value.toLowerCase();

    // Filter based on the active tab
    const contractsToFilter = this.activeTab === 'all' ? this.contracts :
                             this.activeTab === 'signed' ? this.signedContracts :
                             this.unsignedContracts;

    // Apply the filter
    const filtered = contractsToFilter.filter(contract =>
      contract.id.toString().includes(searchTerm) ||
      (contract.nom_contrat && contract.nom_contrat.toLowerCase().includes(searchTerm)) ||
      (contract.email_signataire && contract.email_signataire.toLowerCase().includes(searchTerm)) ||
      (contract.status && contract.status.toLowerCase().includes(searchTerm))
    );

    // Update filtered contracts with the correct format
    this.updateFilteredContractsFromArray(filtered);
  }

  updateFilteredContractsFromArray(contracts: any[]): void {
    if (this.activeTab === 'signed') {
      this.filteredContracts = contracts.map(contract => ({
        ...contract,
        type: 'signed',
        status: 'signed',
        client: contract.nom_contrat,
        startDate: new Date(contract.created_at),
        progress: 100
      }));
    } else if (this.activeTab === 'unsigned') {
      this.filteredContracts = contracts.map(contract => ({
        ...contract,
        type: 'unsigned',
        status: contract.status || 'pending',
        client: contract.nom_contrat,
        startDate: new Date(contract.created_at),
        progress: 50
      }));
    } else {
      // For 'all' tab, we need to determine the type for each contract
      this.filteredContracts = contracts.map(contract => {
        const isSignedContract = this.signedContracts.some(sc => sc.id === contract.id);
        return {
          ...contract,
          type: isSignedContract ? 'signed' : 'unsigned',
          status: isSignedContract ? 'signed' : (contract.status || 'pending'),
          client: contract.nom_contrat,
          startDate: new Date(contract.created_at),
          progress: isSignedContract ? 100 : 50
        };
      });
    }
  }

  setActiveTab(tab: 'all' | 'signed' | 'unsigned'): void {
    this.activeTab = tab;
    this.updateFilteredContracts();
  }

  addNewContract(): void {
    // Redirect to the file upload page
    console.log('Redirecting to file upload page...');
    window.location.href = '/fileupload';
  }

  initCharts(): void {
    this.initActivityChart();
    this.initCompletionChart();
  }

  updateCharts(): void {
    console.log('Updating charts with metrics:', this.metrics);

    // If charts aren't initialized yet, initialize them
    if (!this.activityChart && !this.completionChart &&
        this.activityChartRef?.nativeElement && this.completionChartRef?.nativeElement) {
      this.initCharts();
      return;
    }

    // Update activity chart if it exists
    if (this.activityChart) {
      const activityData = this.getActivityData();
      console.log('Activity chart data:', activityData);
      this.activityChart.data.datasets[0].data = activityData;
      // @ts-ignore - TypeScript doesn't recognize the 'none' mode but it's valid
      this.activityChart.update('none'); // Use 'none' animation mode for smoother updates
    } else {
      console.warn('Activity chart not initialized');
    }

    // Update completion chart if it exists
    if (this.completionChart) {
      // Prepare data for the chart
      const chartData = [
        this.metrics.signed || 0,
        this.metrics.unsigned || 0,
        this.metrics.active || 0
      ];

      console.log('Completion chart data:', chartData);

      // Update chart data
      this.completionChart.data.datasets[0].data = chartData;

      // Update chart colors
      this.completionChart.data.datasets[0].backgroundColor = [
        'rgba(16, 185, 129, 0.7)', // Signed - Green
        'rgba(59, 130, 246, 0.7)',  // Unsigned - Blue
        'rgba(245, 158, 11, 0.7)'   // Pending - Orange
      ];

      this.completionChart.data.datasets[0].borderColor = [
        'rgba(16, 185, 129, 1)', // Signed - Green
        'rgba(59, 130, 246, 1)',  // Unsigned - Blue
        'rgba(245, 158, 11, 1)'   // Pending - Orange
      ];

      // Apply updates
      // @ts-ignore - TypeScript doesn't recognize the 'none' mode but it's valid
      this.completionChart.update('none'); // Use 'none' animation mode for smoother updates
    } else {
      console.warn('Completion chart not initialized');
    }
  }

  getActivityData(): number[] {
    // This would typically come from the API based on the selected period
    const labels = this.getLabelsForPeriod();

    // For demonstration, generate data based on the total number of contracts
    // with some randomness to make it look realistic
    const baseValue = Math.max(1, Math.floor(this.metrics.total / labels.length));

    // Generate data with a slight upward trend and some randomness
    return labels.map((_, index) => {
      // Add a slight upward trend
      const trendFactor = 1 + (index * 0.1);
      // Add some randomness (±30%)
      const randomFactor = 0.7 + (Math.random() * 0.6);
      // Calculate the value
      return Math.max(1, Math.floor(baseValue * trendFactor * randomFactor));
    });
  }

  getLabelsForPeriod(): string[] {
    switch (this.filterPeriod) {
      case 'week':
        return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      case 'month':
        return ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
      case 'quarter':
        return ['Month 1', 'Month 2', 'Month 3'];
      case 'year':
        return ['Q1', 'Q2', 'Q3', 'Q4'];
      default:
        return [];
    }
  }

  initActivityChart(): void {
    if (!this.activityChartRef?.nativeElement) {
      console.warn('Activity chart reference not available');
      return;
    }

    try {
      // Get the canvas context
      const ctx = this.activityChartRef.nativeElement.getContext('2d');
      if (!ctx) {
        console.error('Could not get 2D context for activity chart');
        return;
      }

      // Get labels for the selected period
      const labels = this.getLabelsForPeriod();
      console.log('Activity chart labels:', labels);

      // Prepare chart data
      const data = {
        labels: labels,
        datasets: [{
          label: 'Contract Activity',
          data: this.getActivityData(),
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 2,
          tension: 0.4,
          fill: true
        }]
      };

      // Chart configuration with proper type annotation
      const config: ChartConfiguration<'line'> = {
        type: 'line',
        data: data,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              grid: {
                color: 'rgba(200, 200, 200, 0.2)'
              },
              ticks: {
                color: 'rgba(100, 116, 139, 0.8)'
              }
            },
            x: {
              grid: {
                display: false
              },
              ticks: {
                color: 'rgba(100, 116, 139, 0.8)'
              }
            }
          },
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              padding: 10,
              titleColor: '#fff',
              bodyColor: '#fff',
              borderColor: 'rgba(200, 200, 200, 0.25)',
              borderWidth: 1,
              displayColors: false
            }
          }
        }
      };

      // Create the chart
      this.activityChart = new Chart(ctx, config);
      console.log('Activity chart initialized');
    } catch (error) {
      console.error('Error initializing activity chart:', error);
    }
  }

  initCompletionChart(): void {
    if (!this.completionChartRef?.nativeElement) {
      console.warn('Completion chart reference not available');
      return;
    }

    try {
      // Get the canvas context
      const ctx = this.completionChartRef.nativeElement.getContext('2d');
      if (!ctx) {
        console.error('Could not get 2D context for completion chart');
        return;
      }

      // Ensure metrics have valid values
      const signedCount = this.metrics.signed || 0;
      const unsignedCount = this.metrics.unsigned || 0;
      const activeCount = this.metrics.active || 0;

      console.log('Completion chart initial data:', { signed: signedCount, unsigned: unsignedCount, active: activeCount });

      // Prepare chart data
      const data = {
        labels: ['Signed', 'Unsigned', 'Pending'],
        datasets: [{
          label: 'Contract Status',
          data: [signedCount, unsignedCount, activeCount],
          backgroundColor: [
            'rgba(16, 185, 129, 0.7)', // Signed - Green
            'rgba(59, 130, 246, 0.7)',  // Unsigned - Blue
            'rgba(245, 158, 11, 0.7)'   // Pending - Orange
          ],
          borderColor: [
            'rgba(16, 185, 129, 1)', // Signed - Green
            'rgba(59, 130, 246, 1)',  // Unsigned - Blue
            'rgba(245, 158, 11, 1)'   // Pending - Orange
          ],
          borderWidth: 1,
          hoverOffset: 4
        }]
      };

      // Chart configuration
      const config: ChartConfiguration<'doughnut'> = {
        type: 'doughnut',
        data: data,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          // Use the correct property for doughnut chart cutout percentage
          // @ts-ignore - TypeScript doesn't recognize this property but it's valid for doughnut charts
          cutout: '70%',
          plugins: {
            legend: {
              position: 'right',
              labels: {
                boxWidth: 12,
                padding: 15,
                font: {
                  size: 12
                },
                color: 'rgba(100, 116, 139, 0.8)'
              }
            },
            tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              padding: 10,
              titleColor: '#fff',
              bodyColor: '#fff',
              borderColor: 'rgba(200, 200, 200, 0.25)',
              borderWidth: 1,
            }
          },
        }
      };

      // Create the chart
      this.completionChart = new Chart(ctx, config);
      console.log('Completion chart initialized');
    } catch (error) {
      console.error('Error initializing completion chart:', error);
    }
  }

  /**
   * View contract details
   */
  viewContract(contract: any): void {
    console.log('Viewing contract:', contract);

    if (contract.type === 'signed') {
      // Navigate to signed contract details page
      this.router.navigate(['/security', contract.id], { queryParams: { type: 'signed' } });
    } else {
      // Navigate to unsigned contract details page
      this.router.navigate(['/security', contract.id], { queryParams: { type: 'unsigned' } });
    }
  }

  /**
   * Download contract file
   */
  downloadContract(contract: any): void {
    console.log('Downloading contract:', contract);

    if (contract.type === 'signed') {
      // Download signed contract
      this.signedContractService.downloadSignedContract(contract.id).subscribe(
        (blob: Blob) => {
          console.log('Signed contract downloaded successfully');
          this.downloadFile(blob, `signed_contract_${contract.id}.pdf`);
        },
        (error) => {
          console.error('Error downloading signed contract:', error);
          alert('Failed to download signed contract. Please try again.');
        }
      );
    } else {
      // Download unsigned contract
      this.unsignedContractService.downloadUnsignedContract(contract.id).subscribe(
        (blob: Blob) => {
          console.log('Unsigned contract downloaded successfully');
          this.downloadFile(blob, `unsigned_contract_${contract.id}.pdf`);
        },
        (error) => {
          console.error('Error downloading unsigned contract:', error);
          alert('Failed to download unsigned contract. Please try again.');
        }
      );
    }
  }

  /**
   * Delete contract
   */
  deleteContract(contract: any): void {
    console.log('Deleting contract:', contract);

    if (!confirm(`Are you sure you want to delete this contract: ${contract.client || contract.nom_contrat}?`)) {
      return;
    }

    if (contract.type === 'unsigned') {
      // Delete unsigned contract
      this.unsignedContractService.deleteUnsignedContract(contract.id).subscribe(
        (response) => {
          console.log('Unsigned contract deleted successfully:', response);
          alert('Contract deleted successfully.');
          // Reload dashboard data
          this.loadDashboardData();
        },
        (error) => {
          console.error('Error deleting unsigned contract:', error);
          alert('Failed to delete contract. Please try again.');
        }
      );
    }
  }

  /**
   * Helper method to download a file
   */
  private downloadFile(blob: Blob, fileName: string): void {
    // Create a URL for the blob
    const url = window.URL.createObjectURL(blob);

    // Create a link element
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;

    // Append to the document
    document.body.appendChild(link);

    // Trigger click
    link.click();

    // Clean up
    window.URL.revokeObjectURL(url);
    document.body.removeChild(link);
  }
}